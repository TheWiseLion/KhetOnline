import datetime
import logging
import traceback
import uuid

import flask
from flask import make_response
from flask import request
from flask_restplus import Api
from flask_restplus import Resource
from flask_restplus import abort
from flask_restplus import fields
from pykhet.components.types import TeamColor, Move
from pykhet.games.game_types import ClassicGame

from game.Storage import get_storage_device, GameState, Event, EventType, AILevel, PlayState, _LAST_DELTA

rest_api = Api(version='1.0', title='khet-api', description='Services For Playing The Board Game Khet')

log = logging.getLogger(__name__)

TOKEN_COOKIE_NAME = "playerID"
AI = "AI"


@rest_api.errorhandler
def default_error_handler(e):
    message = 'An unhandled exception occurred.'
    log.exception(message)

    return {'message': message}, 500


auth = rest_api.namespace('auth', description='Authentication Operations')


@auth.route('/login')
@auth.response(429, 'Resource Rate Limit Reached')
class Authorize(Resource):
    def post(self):
        unique_id = uuid.uuid4().hex
        response = make_response(flask.jsonify({TOKEN_COOKIE_NAME: unique_id}, ))
        response.set_cookie(TOKEN_COOKIE_NAME, unique_id)
        return response


games = rest_api.namespace('games', description='Game Operations')
create_game = rest_api.model('CreateGame', {
    'humanOpponent': fields.Boolean(required=False),
    'color': fields.String(required=False, description='The color for the person creating the game',
                           enum=['red', 'silver']),
    'gameType': fields.String(required=False, description='summary for article', enum=["classic"]),
    # Required if human
    'timeLimit': fields.Integer(required=False, description='time limit to make a move in seconds', min=30,
                                max=60 * 60),

    'name': fields.String(required=False, description='summary for article'),
    'aiLevel': fields.String(required=False, description='difficulty level', enum=[AILevel.cake, AILevel.easy,AILevel.medium],
                             default=AILevel.cake),
    'previousGame': fields.String(required=False,
                                  description='Previous game to link to new game. If provided all other fields are ignored.')
})

move_model = rest_api.model('Move', {
    'type': fields.String(required=True),
    'position': fields.Raw(),
    'value': fields.Raw()
})

update_game = rest_api.model('UpdateGame', {
    'move': fields.Raw(allow_null=True,
                       description='The move action to perform. Must be one of the options provided from get function.'),
    'forfeit': fields.Boolean(required=False, default=False, description='whether or not to forfeit'),
    'gameID': fields.String(required=True, description='the ID of the game for an action to be done on')
})

gameID = games.parser()
gameID.add_argument('gameID', type=str, help='id for game')

gameState = games.parser()
gameState.add_argument('gameID', type=str, help='id for game')
gameState.add_argument('countOnly', type=str, help='whether or not to only return the number events in the game',
                       default=False)

# Post: Create Game
# Put: Update Game With {move, forfeit}
# Get: Get Game State {hasChange=time, gameID}

@games.route('')
@games.response(429, 'Resource Rate Limit Reached')
@games.response(400, "Bad Request Parameters")
@games.response(403, 'Must have a playerID cookie set')
class Games(Resource):
    @games.expect(gameState)
    def get(self):
        # Create a new account based on email & password
        args = gameState.parse_args()
        storage = get_storage_device()
        game = storage.get(args.gameID)
        if args.countOnly == 'true':
            return {"count": len(game.events)}

        results = game.to_dictionary()
        # Hide player mapping as it's secret
        results.pop("playerMapping", None)
        return results

    @games.expect(create_game)
    def post(self):
        storage = get_storage_device()
        now = datetime.datetime.utcnow().isoformat()
        if TOKEN_COOKIE_NAME in request.cookies:
            is_human = None
            time_limit = None
            name = None
            game_type = None
            ai_level = None
            player_mapping = None
            linked_game = None
            if "previousGame" in rest_api.payload:
                linked_game = storage.get(rest_api.payload["previousGame"])
                inv_players = {v: k for k, v in linked_game.player_mapping.iteritems()}
                if request.cookies[TOKEN_COOKIE_NAME] not in inv_players:
                    abort(400, 'Cannot Create A New Game Based On Existing Game If You Weren\'t An Original Player')

                if linked_game.linked_game_id is not None:
                    abort(400, 'A new game cannot be created as there is already a linked game....')

                if linked_game.winner is TeamColor.blank:
                    abort(400, 'A new game cannot be created till the current one is over!')

                is_human = 'AI' in inv_players
                ai_level = linked_game.ai_level
                player_mapping = linked_game.player_mapping
                game_type = 'classic'  # TODO: Add multi-mode...
                name = linked_game.name
                time_limit = linked_game.time_limit
                color = TeamColor.silver

            else:
                is_human = rest_api.payload['humanOpponent']
                color = TeamColor(rest_api.payload['color'])
                time_limit = rest_api.payload['timeLimit']
                name = uuid.uuid4().hex if 'name' not in rest_api.payload else rest_api.payload['name']
                game_type = rest_api.payload['gameType']

                ai_level = AILevel.cake
                player_mapping = {color: request.cookies[TOKEN_COOKIE_NAME]}
                if not is_human:
                    player_mapping[TeamColor.opposite_color(color)] = AI
                    ai_level = rest_api.payload['aiLevel']

            board = None
            if game_type == 'classic':
                board = ClassicGame()
            else:
                board = ClassicGame()

            if name is None or len(name) is 0:
                name = "AI: "+ai_level if not is_human else "Human Opponent"
            game = GameState(name, time_limit, board, [Event(EventType.joined, color, now)], player_mapping,
                             TeamColor.silver, TeamColor.blank, ai_level=ai_level)

            # If player is AI and AI is color silver, make the first move...
            if not is_human and color is TeamColor.red:
                game.move_as_ai(TeamColor.silver)

            game_id = storage.put(game)

            # Update Previous Game To Point To New Game
            if linked_game is not None:
                linked_game.linked_game_id = game_id
                linked_game.events.append(
                    Event(EventType.new_game, TeamColor.blank, datetime.datetime.utcnow().isoformat()))
                storage.update(rest_api.payload["previousGame"], linked_game)

            return {"gameId": game_id}

        else:
            abort(403, "Can't create a game without a playerID cookie")

    @games.expect(update_game)
    def put(self):
        cookie = request.cookies[TOKEN_COOKIE_NAME]
        storage = get_storage_device()
        now = datetime.datetime.utcnow().isoformat()
        game_id = rest_api.payload['gameID']
        game = storage.get(game_id)
        inv_map = {v: k for k, v in game.player_mapping.iteritems()}

        # TODO: Don't allow moves till both players join
        if len(game.player_mapping) < 2:
            abort(400, "Both players must join the game...")

        if "forfeit" not in rest_api.payload or not rest_api.payload['forfeit']:
            # Deserialize
            move = None
            try:
                move = Move.from_dictionary(rest_api.payload['move'])
            except:
                abort(400, 'Invalid Move - Bad Format')

            if game.winner is not TeamColor.blank:
                abort(400, 'Game is already over, moves can\'t be made')

        else:
            if inv_map[cookie] is None:
                abort(403, 'Invalid Cookie For Game')

            game.apply_forfeit(inv_map[cookie])
            storage.update(game_id, game)
            return game.to_dictionary()

        current_player_cookie = game.player_mapping[game.moving_player]
        if TOKEN_COOKIE_NAME in request.cookies:

            # Validate Cookie For Player
            if cookie == current_player_cookie:
                try:
                    game = game.apply_move(move, game.moving_player)

                    # Move as AI if the game isn't over...
                    if len(game.player_mapping) == 2 and game.winner is TeamColor.blank and game.player_mapping[
                        game.moving_player] == AI:
                        # Also move for the AI
                        game = game.move_as_ai(game.moving_player)

                    storage.update(game_id, game)
                    return game.to_dictionary()

                except Exception, e:
                    abort(400, traceback.format_exc())

            else:
                abort(400, 'Either invalid cookie or not your turn')

        else:
            abort(403, "Can't create a game without a playerID cookie")


# Rest service to join a game
auth = rest_api.namespace('join', description='Join a game')


@auth.route('')
@auth.response(400, 'Resource Rate Limit Reached')
class Authorize(Resource):
    @games.expect(gameID)
    def post(self):
        """
        The game being joined. Returns the color if accepted else 400 error.
        :return:
        """
        now = datetime.datetime.utcnow().isoformat()
        if TOKEN_COOKIE_NAME in request.cookies:
            cookie = request.cookies[TOKEN_COOKIE_NAME]
            args = gameID.parse_args()
            storage = get_storage_device()
            game = storage.get(args.gameID)

            if len(game.player_mapping) > 1:
                abort(400, "Game already has two players")
            else:
                color = TeamColor.opposite_color(game.player_mapping.keys()[0])
                game.player_mapping[color] = cookie
                game.events.append(Event(EventType.joined, color, now))
                storage.update(args.gameID, game)

                can_play = []
                is_ai = False
                for k, v in game.player_mapping.iteritems():
                    if v == cookie:
                        can_play.append(k.value)
                    if v == AI:
                        is_ai = True

                return {"inPlay": [x.value for x in game.player_mapping.keys()],
                "canPlay": can_play,
                "opponentIsAI": is_ai}

        else:
            abort(403, "Can't join a game without a playerID cookie")

    @games.expect(gameID)
    def get(self):
        """
        Returns all players assigned and all sides that can be played
        :return:
        """
        args = gameID.parse_args()
        storage = get_storage_device()
        game = storage.get(args.gameID)
        can_play = []
        is_ai = False
        if TOKEN_COOKIE_NAME in request.cookies:
            cookie = request.cookies[TOKEN_COOKIE_NAME]
            for k, v in game.player_mapping.iteritems():
                if v == cookie:
                    can_play.append(k.value)
                if v == AI:
                    is_ai = True
        else:
            abort(403, 'Must have cookie set...')

        return {"inPlay": [x.value for x in game.player_mapping.keys()],
                "canPlay": can_play,
                "opponentIsAI": is_ai}


search_params = games.parser()
search_params.add_argument('offSet', type=int, help='offset', default=0)
search_params.add_argument('gameState',  help='id for game',  default=PlayState.pending, type=str)
search_params.add_argument('sort',  help='field to sort by',  default=_LAST_DELTA, type=str)

search = rest_api.namespace('search', description='Find Open Games')
# enum=[PlayState.pending, PlayState.complete, PlayState.playing],

@search.route('')
@search.response(400, 'Resource Rate Limit Reached')
class Search(Resource):
    @search.expect(search_params)
    def get(self):
        """
        Return pending games
        :return:
        """
        args = search_params.parse_args()
        storage = get_storage_device()
        offset = args.offSet if (args.offSet is not None) else 0
        matching_games, size = storage.get_games(offset, 100, args.gameState)
        return {
            "size": size,
            "games": matching_games
        }

