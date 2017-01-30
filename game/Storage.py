import uuid
from abc import ABCMeta, abstractmethod

import datetime

# import ndb
from google.appengine.ext import ndb
from  flask_restplus import abort
from pykhet.components.board import KhetBoard
from pykhet.components.types import TeamColor, Move, Position, Piece, MoveType
from pykhet.games.game_types import ClassicGame, Game

from enum import Enum
from pykhet.solvers.minmax import MinmaxSolver


class PlayState(object):
    pending = "pending"
    playing = "playing"
    complete = "complete"


class EventType(Enum):
    played = "played"
    forfeit = "forfeit"
    disconnected = "disconnected"
    won = "won"
    skipped = "skipped"
    destroyed = "destroyed"
    joined = "joined"
    new_game = "created new game"


class AILevel(object):
    cake = "cake"
    easy = "easy"


# Played, TeamColor, ISOTime, Move
# Destroyed, TeamColor, ISOTime, {Position, Piece}
# Won, TeamColor, ISOTime
# Forfeit, TeamColor, ISOTime
# Disconnected, TeamColor, ISOTime


class Event(object):
    def __init__(self, event_type, player, time, value=None):
        self.type = event_type
        self.player = player
        self.value = value
        self.time = time  # UTC time the event happened (ISO string)

    def to_dictionary(self):
        value = {"type": self.type.value,
                 "player": self.player.value,
                 "time": self.time}
        if self.value is not None:
            if self.type is EventType.played:
                value["value"] = self.value.to_dictionary()
            elif self.type is EventType.destroyed:
                value["value"] = {"position": self.value["position"].to_dictionary(),
                                  "piece": self.value["piece"].to_dictionary()}

        return value

    @staticmethod
    def from_dictionary(value):
        event_type = EventType(value["type"])
        player = TeamColor(value["player"])
        time = value["time"]
        event_value = None
        if event_type is EventType.played:
            event_value = Move.from_dictionary(value["value"])
        elif event_type is EventType.destroyed:
            pos = Position.from_dictionary(value["value"]["position"])
            piece = Piece.from_dictionary(value["value"]["piece"])
            event_value = {"position": pos, "piece": piece}

        return Event(event_type, player, time, event_value)


class GameState(object):
    def __init__(self, name, time_limit, board, event_list, player_mapping, moving_player, winner, previous_boards=[],
                 ai_level='', linked_game_id=None):
        self.name = name
        self.time_limit = time_limit
        self.board = board
        self.events = event_list  # Move, Destroyed, Forfeit, Disconnect, etc
        # {"red": "AI", "silver": "432423-cookie-21321"}
        self.player_mapping = player_mapping
        self.moving_player = moving_player
        self.winner = winner
        self.linked_game_id = linked_game_id
        if TeamColor.blank is not moving_player:
            self.moving_player_moves = self.board.get_available_moves(moving_player)
        else:
            self.moving_player_moves = []

        self.red_laser = self.board.get_laser_path(TeamColor.red)
        self.silver_laser = self.board.get_laser_path(TeamColor.silver)
        self.ai_level = ai_level
        self.previous_boards = previous_boards
        if len(previous_boards) == 0:
            self.previous_boards.append(self.store_previous_state())

    # TODO: Add a minimum storage model
    def to_dictionary(self):
        data = {
            "name": self.name,
            "board": self.board.to_serialized_squares(),
            "events": [x.to_dictionary() for x in self.events],
            "movingPlayer": self.moving_player.value,
            "availableMoves": [x.to_dictionary() for x in self.moving_player_moves],
            "winner": self.winner.value,
            "playerMapping": {k.value: v for k, v in self.player_mapping.iteritems()},
            "timeLimit": self.time_limit,
            "redLaserPath": [x.to_dictionary() for x in self.red_laser],
            "silverLaserPath": [x.to_dictionary() for x in self.silver_laser],
            "previousBoards": self.previous_boards[:],
            "aiLevel": self.ai_level
        }
        if self.linked_game_id is not None:
            data["linkedGameId"] = self.linked_game_id

        return data

    # TODO: ...
    # def to_storage_dictionary(self):
    #     """
    #     The minimium amount of data that is required to be stored to compute all previous states
    #     :return:
    #     """

    @staticmethod
    def from_dictionary(value):
        name = value["name"]
        time_limit = value["timeLimit"]
        board = Game.from_serialized_squares(value["board"])
        event_list = [Event.from_dictionary(x) for x in value["events"]]
        player_mapping = {TeamColor(k): val for k, val in
                          value["playerMapping"].iteritems()}
        moving_player = TeamColor(value["movingPlayer"])
        winner = TeamColor(value["winner"])
        linked_game_id = value["linkedGameId"] if "linkedGameId" in value else None

        return GameState(name, time_limit, board, event_list, player_mapping, moving_player, winner,
                         value["previousBoards"], value["aiLevel"], linked_game_id)

    def store_previous_state(self):
        return {
            "board": self.board.to_serialized_squares(),
            "laserPath": [x.to_dictionary() for x in self.board.get_laser_path(self.moving_player)],
            "movingPlayer": self.moving_player.value
        }

    def check_time(self):
        # Set Winner / Loser Based On Time...
        pass

    def apply_move(self, move, color):
        """
        Applies move for color. Fails if game is over.
        Also updates event states
        :param game_state:
        :param move:
        :param color:
        :return:
        """
        now = datetime.datetime.utcnow().isoformat()
        if self.winner is not TeamColor.blank:
            abort(400, "Game is already over. State cannot be modified")

        self.board.apply_move(move)
        pre_laser = self.store_previous_state()  # Post Move - Pre-laser
        results = self.board.apply_laser(color)

        # Add move event
        self.events.append(Event(EventType.played, color, now, move))

        # Add destroy event
        if "destroyed" in results:
            last_pos = results["path"][-1].position
            piece = results["destroyed"]
            self.previous_boards.append(pre_laser)
            self.events.append(Event(EventType.destroyed, color, now, {"position": last_pos, "piece": piece}))

        # Add Post Move + Laser Board
        self.previous_boards.append(self.store_previous_state())

        # Update Moving Player
        self.moving_player = TeamColor.opposite_color(color)
        # Update Winner
        if self.board.winner is not None:
            self.winner = self.board.winner
            self.events.append(Event(EventType.won, self.winner, now))
            self.moving_player = TeamColor.blank

        # Return new instance
        return GameState.from_dictionary(self.to_dictionary())

    def apply_forfeit(self, color):
        """
        Color will forfeit
        :param color:
        :return:
        """
        now = datetime.datetime.utcnow().isoformat()
        if self.winner is TeamColor.blank:
            self.winner = TeamColor.opposite_color(color)
            self.events.append(Event(EventType.forfeit, color, now))
            self.events.append(Event(EventType.won, self.winner, now))
            self.moving_player_moves = []
            return self
        else:
            abort(400, 'winner already set')

    def move_as_ai(self, color):
        solver = None
        if self.ai_level == AILevel.cake:
            solver = MinmaxSolver(max_evaluations=100)
        else:
            solver = MinmaxSolver(max_evaluations=1000)

        move = solver.get_move(self.board, color)
        return self.apply_move(move, color)

    def get_play_state(self):
        if self.winner is not TeamColor.blank:
            return PlayState.complete
        if len(self.player_mapping) < 2:
            return PlayState.pending

        return PlayState.playing

    def __str__(self):
        return "{ name:" + str(self.name) + ",\n timeLimit: " \
               + str(self.time_limit) \
               + ",\n board: " + str(self.board.to_serialized_squares()) \
               + " ,\n events: " + str([e.to_dictionary() for e in self.events]) \
               + ",\n mapping: " + str({x.value: y for x, y in self.player_mapping.iteritems()}) \
               + ",\n mover: " + str(self.moving_player) \
               + ",\n winner: " + str(self.winner.value) \
               + "}"


class GameStorage(object):
    """
    Abstract Game Storage Class
    """
    __metaclass__ = ABCMeta

    @abstractmethod
    def get(self, unique_id):
        """
        Returns dictionary of game state.
        Aborts with 404 if not found
        :param unique_id:
        :return: GameState object
        """
        raise NotImplementedError("Not Implemented")

    @abstractmethod
    def put(self, game_state):
        """
        Creates a new object
        :param value: game_state to store
        :return: unique Identifier
        """
        raise NotImplementedError("Not Implemented")

    @abstractmethod
    def update(self, unique_id, game_state):
        """
        Sets the value stored by the unique ID
        :param unique_id: str
        :param game_state: game_state to store
        """
        raise NotImplementedError("Not Implemented")

    def get_games(self, offset, max_results, play_state):
        """
        Returns list of unique_id's
        :param offset:
        :param max_results: max number of results
        :param play_state: whether or not the game is: in play, pending players, complete
        :return:
        """
        raise NotImplementedError("Not Implemented")


class RAMStore(GameStorage):
    _ram_store = {}
    _in_play = set()
    _complete = set()
    _pending = set()
    _mapping = {PlayState.playing: _in_play,
                PlayState.pending: _pending,
                PlayState.complete: _complete}

    def _remove(self, id):
        RAMStore._in_play.discard(id)
        RAMStore._complete.discard(id)
        RAMStore._pending.discard(id)

    def get(self, unique_id):
        raw_value = None
        try:
            raw_value = RAMStore._ram_store[unique_id]
        except:
            abort(404, "Game not found (" + unique_id + ")")
        return GameState.from_dictionary(raw_value)

    def put(self, game_state):
        unique_id = uuid.uuid4().hex
        RAMStore._ram_store[unique_id] = game_state.to_dictionary()
        RAMStore._mapping[game_state.get_play_state()].add(unique_id)
        return unique_id

    def update(self, unique_id, game_state):
        RAMStore._ram_store[unique_id] = game_state.to_dictionary()
        self._remove(unique_id)  # Remove mapping (state may have changed)
        RAMStore._mapping[game_state.get_play_state()].add(unique_id)

    def get_games(self, offset, max_results, play_state):
        """
        Returns list of unique_id's
        :param offset:
        :param max_results: max number of results
        :param play_state: whether or not the game is: in play, pending players, complete
        :return:
        """
        lst = list(RAMStore._mapping[play_state])
        if offset > len(lst):
            abort("Offset Larger Than All Results")
        return lst[offset:min(offset + max_results, len(lst))], len(lst)


class GoogleGameStateStore(ndb.Model):
    game_state = ndb.StringProperty()
    game_data = ndb.JsonProperty()  # Potentially Useful To Compress...

    @staticmethod
    def from_game_state(game_state, game_id):
        return GoogleGameStateStore(game_state=game_state.get_play_state(),
                                    id=game_id,
                                    game_data=game_state.to_dictionary())

    def to_state(self):
        return GameState.from_dictionary(self.game_data)


class GoogleDataStore(GameStorage):
    """
    Storage That Uses Google Data Store Engine
    """

    def get(self, unique_id):
        """
        Returns dictionary of game state.
        Aborts with 404 if not found
        :param unique_id:
        :return: GameState object
        """
        try:
            return GoogleGameStateStore.get_by_id(unique_id).to_state()
        except:
            abort(404, "Game not found")

    def put(self, game_state):
        """
        Creates a new object
        :param value: game_state to store
        :return: unique Identifier
        """
        try:
            unique_id = uuid.uuid4().hex
            GoogleGameStateStore.from_game_state(game_state, unique_id).put()
            return unique_id
        except:
            abort(500, "Google Data Store Error")

    def update(self, unique_id, game_state):
        """
        Sets the value stored by the unique ID
        :param unique_id: str
        :param game_state: game_state to store
        """
        try:
            GoogleGameStateStore.from_game_state(game_state, unique_id).put()
        except:
            abort(500, "Google Data Store Error")

    def get_games(self, offset, max_results, play_state):
        """
        Returns list of unique_id's
        :param offset:
        :param max_results: max number of results
        :param play_state: whether or not the game is: in play, pending players, complete
        :return:
        """
        query = GoogleGameStateStore.query(GoogleGameStateStore.game_state == play_state)
        results = query.fetch(keys_only=True, offset=offset, limit=max_results)
        return [x.id() for x in results], query.count()


def get_storage_device():
    # TODO: use environment variables to determine:
    # Prod / Local
    # Credentials For Prod
    return GoogleDataStore()
