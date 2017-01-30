# Tests For Serialization / Deserialization of game state
# Test two bots playing against each other
import unittest
import uuid

import datetime
from pykhet.components.types import TeamColor
from pykhet.games.game_types import ClassicGame

from game.Storage import GameState, Event, EventType, RAMStore


class TestGameState(unittest.TestCase):
    def setUp(self):
        pass

    def tearDown(self):
        pass

    def test_simple_serialization(self):
        is_human = False
        color = TeamColor.silver
        player_cookies = "some long cookie"
        time_limit = 30
        name = 'Test game name!'
        game_type = 'classic'
        now = datetime.datetime.utcnow().isoformat()

        board = None
        if game_type is 'classic':
            board = ClassicGame()
        else:
            board = ClassicGame()

        player_mapping = {color: player_cookies}
        if not is_human:
            player_mapping[TeamColor.opposite_color(color)] = "AI"

        game = GameState(name, time_limit, board, [Event(EventType.joined, color, now)], player_mapping,
                         TeamColor.silver, TeamColor.blank)

        self.assertEquals(str(game.from_dictionary(game.to_dictionary())), str(game))

    def test_simple_move(self):
        is_human = False
        color = TeamColor.red
        player_cookies = "some long cookie"
        time_limit = 30
        name = 'Test game name!'
        game_type = 'classic'
        now = datetime.datetime.utcnow().isoformat()

        board = None
        if game_type is 'classic':
            board = ClassicGame()
        else:
            board = ClassicGame()

        player_mapping = {color: player_cookies}
        if not is_human:
            player_mapping[TeamColor.opposite_color(color)] = "AI"

        game = GameState(name, time_limit, board, [Event(EventType.joined, color, now)], player_mapping,
                         TeamColor.silver, TeamColor.blank)

        # Move the silver player
        game.move_as_ai(color=TeamColor.silver)
        self.assertEquals(str(game.from_dictionary(game.to_dictionary())), str(game))
        self.assertEquals(game.moving_player, TeamColor.red)
        self.assertTrue(len(game.events) > 1)


class TestRAMStorage(unittest.TestCase):
    def setUp(self):
        pass

    def tearDown(self):
        pass

    def test_simple(self):
        is_human = False
        color = TeamColor.red
        player_cookies = "some long cookie"
        time_limit = 30
        name = 'Test game name!'
        game_type = 'classic'
        now = datetime.datetime.utcnow().isoformat()

        board = None
        if game_type is 'classic':
            board = ClassicGame()
        else:
            board = ClassicGame()

        player_mapping = {color: player_cookies}
        if not is_human:
            player_mapping[TeamColor.opposite_color(color)] = "AI"

        game = GameState(name, time_limit, board, [Event(EventType.joined, color, now)], player_mapping,
                         TeamColor.silver, TeamColor.blank)

        # Move the silver player
        game.move_as_ai(color=TeamColor.silver)

        store = RAMStore()
        game_id = store.put(game)

        game_retrieved = store.get(game_id)
        game_retrieved.move_as_ai(color=game_retrieved.moving_player)
        store.update(game_id, game_retrieved)

        # Validate the game has changed since initial storage
        self.assertNotEquals(str(game), store.get(game_id))
