(function () {

    function timeSince(date) {

        var seconds = Math.floor((new Date() - date) / 1000);

        var interval = Math.floor(seconds / 31536000);

        if (interval > 1) {
            return interval + " years ago";
        }
        interval = Math.floor(seconds / 2592000);
        if (interval > 1) {
            return interval + " months ago";
        }
        interval = Math.floor(seconds / 86400);
        if (interval > 1) {
            return interval + " days ago";
        }
        interval = Math.floor(seconds / 3600);
        if (interval > 1) {
            return interval + " hours ago";
        }
        interval = Math.floor(seconds / 60);
        if (interval > 1) {
            return interval + " minutes ago";
        }
        return Math.floor(seconds) + " seconds ago";
}

Array.prototype.diff = function(a) {
    return this.filter(function(i) {return a.indexOf(i) < 0;});
};

String.prototype.capitalizeFirstLetter = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

function DialogController($scope, $mdDialog) {
    $scope.hide = function() {
        console.log("?");
        $mdDialog.hide();
    };

    $scope.cancel = function() {
        $mdDialog.cancel();
    };
}

// Routes -> Create / About / Play / Statistics
var app = angular.module("myApp", ["ngRoute","ngMaterial", 'ngCookies','smart-table']);
app.config(function($routeProvider) {
    $routeProvider.when("/how-to-play", {
        templateUrl : "static/partials/HowToPlay.html",
        controller: 'HowToPlay'
    })
    .when("/about", {
        templateUrl : "static/partials/About.html"
    })
    .when("/games", {
        templateUrl : "static/partials/CreateGame.html",
        controller: 'CreateCtrl',
        controllerAs: 'ctrl'
    })
    .when("/play", {
        templateUrl : "static/partials/PlayGame.html",
        controller: 'PlayCtrl',
        controllerAs: 'ctrl'
    }).otherwise({
        templateUrl : "static/partials/CreateGame.html",
        controller: 'CreateCtrl',
        controllerAs: 'ctrl'
    });
});

app.factory('soundService', function () {
    var service = {};
    service.soundLevel = .25;
    //Load Sounds
    createjs.Sound.initializeDefaultPlugins();
    var sounds = [
        {id: 'move1', src: 'move1.mp3'},
        {id: 'move2', src: 'move2.mp3'},
        {id: 'laser', src: 'laser.mp3'},
        {id: 'startend', src: 'startend.mp3'}
    ];
    createjs.Sound.alternateExtensions = ["mp3"];

    function handleLoad(event) {
        console.log("Loaded Sound:");
        console.log(event);
    }
    // create an array and audioPath (above)
    createjs.Sound.addEventListener("fileload", handleLoad);
    createjs.Sound.registerSounds(sounds, 'static/sounds/');

    service.playMoveSound = function (color) {
        var ppc = new createjs.PlayPropsConfig().set({interrupt: createjs.Sound.INTERRUPT_EARLY, loop: 0, volume: service.soundLevel});
        if(color == 'red'){
            createjs.Sound.play("move1", ppc);
        }else{
            createjs.Sound.play("move2", ppc);
        }
    };

    service.playLaserSound = function () {
        var ppc = new createjs.PlayPropsConfig().set({interrupt: createjs.Sound.INTERRUPT_EARLY, loop: 0, volume: service.soundLevel});
        createjs.Sound.play("laser", ppc);
    };

    service.endSound = function () {
        var ppc = new createjs.PlayPropsConfig().set({interrupt: createjs.Sound.INTERRUPT_EARLY, loop: 0, volume: service.soundLevel});
        createjs.Sound.play("startend", ppc);
    };

    service.setSoundLevel=function(soundLevel){
      if(soundLevel <= 1.0 && soundLevel >= 0.0){
          service.soundLevel = soundLevel;
      }else{
          throw "Sound must between 0.0 and 1.0";
      }
    };

    return service;
});

app.factory('khetService', function ($q, $http,$location, $cookies, $mdDialog, $timeout, $window, $route) {
    var service = {};
    var base = $location.protocol()+"://"+$location.host()+":"+$location.port()+"/api/";

    service.getGame = function (gameID, countOnly) {
        countOnly = (countOnly==undefined)? false : countOnly;
        var deferred = $q.defer();
        //Make HTTP request
        $http({
            method: 'GET',
            url: base+"games?gameID="+encodeURI(gameID)+"&countOnly="+encodeURI(countOnly+"")
        }).then(function successCallback(response) {
            // this callback will be called asynchronously
            // when the response is available
            deferred.resolve(response.data);
        }, function errorCallback(response) {});


        return deferred.promise;
    };

    service.getSide = function (gameID) {
        var deferred = $q.defer();
        service.login().then(function () {
            $http({
                method: 'GET',
                url: base + "join?gameID=" + encodeURI(gameID)
            }).then(function successCallback(response) {
                // this callback will be called asynchronously
                // when the response is available
                deferred.resolve(response.data);
            }, function errorCallback(response) {
            });
        });
        return deferred.promise;
    };

    service.login = function () {
        //Sets cookie
        var deferred = $q.defer();
        console.log("Logging in ");
        //Make HTTP request
        if($cookies.get('playerID') == null){
            $http({
                method: 'POST',
                url: base+"auth/login"
            }).then(function successCallback(response) {
                $cookies.put('playerID', response.data.playerID);
                deferred.resolve(response.data.playerID);
                console.log("New Player ID: " +response.data.playerID);
            }, function errorCallback(response) {});
        }else{
            console.log("Player ID: " +$cookies.get('playerID'));
            deferred.resolve($cookies.get('playerID'));
        }

        return deferred.promise;
    };

    service.makeMove = function(gameID, move){
        var deferred = $q.defer();
        var data = {gameID: gameID, move: move};
        service.login().then(function () {
            $http({
                method: 'PUT',
                url: base + "games",
                data: data
            }).then(function successCallback(response) {
                // this callback will be called asynchronously
                // when the response is available
                deferred.resolve(response.data);
            }, function errorCallback(response) {
            });
        });
        return deferred.promise;
    };

    service.forfeit = function(gameID){
        var deferred = $q.defer();
        var data = {gameID: gameID, forfeit: true};
        service.login().then(function () {
            $http({
                method: 'PUT',
                url: base+"games",
                data: data
            }).then(function successCallback(response) {
                // this callback will be called asynchronously
                // when the response is available
                deferred.resolve(response.data);
            }, function errorCallback(response) {});
        });

        return deferred.promise;
    };

    service.createGame = function (payload) {
        var deferred = $q.defer();
        service.login().then(function () {
            $http({
                method: 'POST',
                url: base+"games",
                data: payload
            }).then(function successCallback(response) {
                // this callback will be called asynchronously
                // when the response is available
                deferred.resolve(response.data);
            }, function errorCallback(response) {});
        });

        return deferred.promise;
    };

    service.createGameWithModal = function(requestPayload){
        var loading = $mdDialog.show({
            controller: DialogController,
            templateUrl: 'static/partials/CreateModal.html',
            parent: angular.element(document.body),
            clickOutsideToClose:false
        });

        //If rest call is made model wont show -_-
        $timeout(function () {
            var game = service.createGame(requestPayload);

            game.then(function(data){
                $mdDialog.hide('complete');
                console.log("Redirect To New Game!");
                console.log(data);
                $window.location.href = '/#!/play?gameID='+encodeURI(data.gameId);
                $window.location.reload();
            });

        },250);
    };

    service.joinGame = function(gameID){
        var deferred = $q.defer();
        service.login().then(function () {
            $http({
                method: 'POST',
                url: base+"join?gameID="+encodeURI(gameID)
            }).then(function successCallback(response) {
                // this callback will be called asynchronously
                // when the response is available
                deferred.resolve(response.data);
            }, function errorCallback(response) {});
        });


        return deferred.promise;
    };

    service.findGames = function(gameState, offset, limit){
        var deferred = $q.defer();
        gameState = (gameState == undefined) ? "pending" : gameState;
        offset = (offset == undefined) ? 0 : offset;
        limit = (limit == undefined) ? 25 : limit;

        $http({
            method: 'GET',
            url: base+"search?gameState="+gameState+'&offset='+offset+"&limit="+limit
        }).then(function successCallback(response) {
            // Returns game ID's then make calls following each game details...
            var gameIds = response.data.games;
            var cnt = 0;
            var required = gameIds.length;
            var games = [];
            gameIds.forEach(function (e) {
                service.getGame(e).then(function (game_stats) {
                    var gname = (game_stats.name==null || game_stats.name.length==0)? "-Not Named-":game_stats.name;
                    games.push({name: gname,
                        timeLimit: game_stats.timeLimit,
                        move: game_stats.events.length,
                        id: e,
                        mode: game_stats.mode,
                        lastActive: timeSince(new Date(game_stats.events[game_stats.events.length-1].time))
                    });

                    //Do some logic so you only switch lists when all queries are done....
                    //If this isn't done you get annoying jitter
                    cnt += 1;
                    if(cnt == required){
                        deferred.resolve(
                            {
                                games: games,
                                total: response.data.size
                            }
                        );
                    }

                });
            });
        }, function errorCallback(response) {});
        return deferred.promise;
    };

    service.login();
    return service;
});

// Create Controller
app.controller('CreateCtrl', function CreateCtrl(khetService, $window, $timeout, $mdDialog, $interval,$scope,$route) {
    console.log("New Create Ctrl");
    var ctrl = {};
    ctrl.mode = "classic";
    ctrl.opponent = "human";
    ctrl.turnTime = 60;
    ctrl.color = "silver";
    ctrl.name = "";
    ctrl.level = "cake";
    ctrl.gameID = "";
    ctrl.createGame = function(){
        //TODO: Show Page Loading
        khetService.createGameWithModal({
            color: ctrl.color,
            gameType: ctrl.mode,
            humanOpponent: (ctrl.opponent=='human'),
            name: ctrl.name,
            timeLimit: ctrl.turnTime,
            aiLevel: ctrl.level
        });
    };





    ctrl.joinGame = function(){
        var id = ctrl.gameID;
        if (id > 0){
            khetService.getGame(id).then(function(e){
                $window.location.href = '/#!/play?gameID='+encodeURI(id);
                $window.location.reload();
            })
        }

    };

    ctrl.joinExisting = function(game){
        console.log("clicked");
        $window.location.href = '/#!/play?gameID='+encodeURI(game);
        $window.location.reload();
    };

    ctrl.displayedOpenGames = [];
    ctrl.isLoadingOpenGames = false;
    ctrl.callOpenGames = function callServer(tableState) {
        ctrl.isLoadingOpenGames = true;

        var pagination = tableState.pagination;

        var start = pagination.start || 0;     // This is NOT the page number, but the index of item in the list that you want to use to display the table.
        var number = pagination.number || 25;  // Number of entries showed per page.

        khetService.findGames('pending',start, number).then(function (result) {
          ctrl.displayedOpenGames = result.games;
          tableState.pagination.numberOfPages = result.total/25;//set the number of pages so the pagination can update
          ctrl.isLoadingOpenGames = false;
        });
    };

    ctrl.displayedOnGoingGames = [];
    ctrl.isLoadingOnGoingGames = false;
    ctrl.callOnGoingGames = function callServer(tableState) {
        ctrl.isLoadingOnGoingGames = true;

        var pagination = tableState.pagination;

        var start = pagination.start || 0;     // This is NOT the page number, but the index of item in the list that you want to use to display the table.
        var number = pagination.number || 25;  // Number of entries showed per page.

        khetService.findGames('playing',start, number).then(function (result) {
          ctrl.displayedOnGoingGames = result.games;
          tableState.pagination.numberOfPages = result.total/25;//set the number of pages so the pagination can update
          ctrl.isLoadingOnGoingGames = false;
        });
    };

    ctrl.displayedCompletedGames = [];
    ctrl.isLoadingCompletedGames = false;
    ctrl.callCompletedGames = function callServer(tableState) {
        ctrl.isLoadingCompletedGames = true;

        var pagination = tableState.pagination;

        var start = pagination.start || 0;     // This is NOT the page number, but the index of item in the list that you want to use to display the table.
        var number = pagination.number || 25;  // Number of entries showed per page.

        khetService.findGames('complete',start, number).then(function (result) {
          ctrl.displayedCompletedGames = result.games;
          tableState.pagination.numberOfPages = result.total/25;//set the number of pages so the pagination can update
          ctrl.isLoadingCompletedGames = false;
        });
    };

    ctrl.refresh = function () {
        $route.reload();
    };

    return ctrl;
});

app.controller('PlayCtrl', function PlayCtrl($scope, $routeParams,$timeout, $window, khetService, $mdDialog, $interval, $q,$route, soundService) {
    console.log("New Play Ctrl");
    var ctrl = {};
    $scope.lastPattern = null;
    ctrl.game = {};
    ctrl.side = 'observer';
    ctrl.gameOver = false;
    ctrl.nextGame = null;
    ctrl.updating = false; // Set True When HTTP call is being made that will change the game state...
    ctrl.moveEvent = null;
    $scope.ctrl = ctrl;
    ctrl.moveIndex = -1;
    $scope.silverLaser = null;
    $scope.playMode = false;
    $scope.redLaser = null;
    ctrl.viewingPrevious = false;
    ctrl.gameStarted = false;

    var joinedGame = $q.defer();
    var RENDER_RATE = 1500;
    var UPDATE_RATE = 2000;

    if ($routeParams["gameID"] == null){
        console.log("Redirect!");
        $window.location.href = '/#!/games';
    }

    var gameID = $routeParams["gameID"];
    console.log("Game: "+gameID);


    var update = function(state, moveIndex){
        $scope.game = ctrl.game;
        $scope.boardPieces = [];
        $scope.board = {};
        $scope.moves = {}; // move[x][y] ==> Moves originating from that position

        //Only Show Moves...
        if(moveIndex == ctrl.game.events.length-1 && ctrl.gameStarted){
            //noinspection JSUnresolvedVariable
            ctrl.game.availableMoves.forEach(function (element) {
                var row = $scope.moves[element.position.x];
                if (row==null){
                    row = {};
                    $scope.moves[element.position.x] = row
                }
                //noinspection JSUnresolvedVariable
                if( row[element.position.y] == null){
                    row[element.position.y] = [];
                }
                row[element.position.y].push(element);
            });
        }

        var boardIndex = 0;
        state.events.slice(0,moveIndex+1).forEach(function (e) {
                if(e.type=='played' || e.type=='destroyed'){
                    boardIndex += 1;
                }
        });
        console.log("Board Index: "+boardIndex);

        var board =null;

        if(moveIndex == state.events.length-1 || boardIndex >= state.previousBoards.length){
            board = state.board;
            $scope.silverLaser = state.silverLaserPath;
            $scope.redLaser = state.redLaserPath;
        }else{
            board = state.previousBoards[boardIndex].board;
            $scope.silverLaser = $scope.redLaser = null;
            if (state.previousBoards[boardIndex].movingPlayer == 'red'){
                $scope.redLaser = state.previousBoards[boardIndex].laserPath;
            }else {
                $scope.silverLaser = state.previousBoards[boardIndex].laserPath;
            }
        }

        $scope.boardPieces = board;
        board.forEach(function(element) {
            var row = $scope.board[element.position.x];
            if (row==null){
                row = {};
                $scope.board[element.position.x] = row
            }

            //noinspection JSUnresolvedVariable
            row[element.position.y] = element.piece;
        });

        ctrl.moveIndex = moveIndex
    };


    var join = function (result, q) {
        console.log("Got Side:");
        console.log(result);

        if (result.canPlay.length > 0){
            ctrl.side = result.canPlay[0];
            q.resolve()
        }else if (result.inPlay.length < 2){
            console.log("Show options in modal");
            var newScope = $scope.$new(true, $scope);
            var joinScreen = $mdDialog.show({
                scope: newScope,
                controller: DialogController,
                templateUrl: 'static/partials/JoinModal.html',
                parent: angular.element(document.body),
                clickOutsideToClose:false
            });
            joinScreen.then(function() {
                // Join Game
                khetService.joinGame(gameID).then(function (newResults) {
                    join(newResults, q);
                });
            }, function() {
                //Play as observer....
                console.log("Joined As Observer");
                ctrl.side = 'observer';
                q.resolve();
            });

        }else{
            q.resolve();
            ctrl.side = 'observer'
        }
        ctrl.opponentIsAI = result.opponentIsAI;

        //Some Logic For Figuring Out
        if(ctrl.opponentIsAI){
            ctrl.gameStarted = true;
        }else if(result.inPlay.length == 2){
            ctrl.gameStarted = true;
        }

    };

    // Get The Side I'm Playing On
    khetService.getSide(gameID).then(function(result){
        join(result, joinedGame);
    });

    $scope.applyMove = function(move){
        ctrl.updating = true;
        console.log("Applying Move");
        ctrl.makingMove = move;
        var newScope = $scope.$new(true, $scope);
        newScope.opponentIsAI =  ctrl.opponentIsAI;
        var loading = $mdDialog.show({
            scope: newScope,
            controller: DialogController,
            templateUrl: 'static/partials/MoveModal.html',
            parent: angular.element(document.body),
            clickOutsideToClose:false
        });


        //If rest call is made model wont show -_-
        $timeout(function () {
            khetService.makeMove(gameID, move).then(function(result){
                console.log("Update From Move");
                ctrl.game = result;
                $mdDialog.hide('complete');
                ctrl.playMove(ctrl.moveIndex+1);
                ctrl.startRendering();
                ctrl.updating = false;
            });
        },250);

    };

    ctrl.playMove = function (index) {
        console.log("Update Event: "+(index));
        var newEvent = ctrl.game.events[index];
        ctrl.moveEvent = newEvent;
        update(ctrl.game, index);
        //If Game Not over and event.type == 'won' and we're not the observer
        if(ctrl.gameOver == false && newEvent.type == 'won' && ctrl.side != 'observer'){
            ctrl.gameOver = true;
            ctrl.showEndScreen();
        }

        if(newEvent.type == 'played'){
            soundService.playMoveSound(newEvent.player);
        }

        if(newEvent.type == 'destroyed'){
            soundService.playLaserSound();
        }




    };

    //Render New Moves (1 per 2.5 seconds)
    ctrl.startRendering = function(){
      $timeout(function () {
              if(ctrl.game != null && ctrl.game.events!=null && ctrl.moveIndex < ctrl.game.events.length-1 && !ctrl.viewingPrevious){
                  // Play Sound. Correct Sound (e.g move, laser, etc)
                  ctrl.playMove(ctrl.moveIndex+1);
                  ctrl.startRendering();
              }
      }, RENDER_RATE);

    };


    ctrl.goBackMove = function () {
        ctrl.viewingPrevious = true;
        ctrl.playMove(ctrl.moveIndex-1);
    };

    ctrl.goForwardMove = function () {
        console.log(ctrl.moveIndex +" vs "+ctrl.game.events.length);
        ctrl.playMove(ctrl.moveIndex+1);
        //Check if we're back up to play speed
        if(ctrl.moveIndex == ctrl.game.events.length-1){
            ctrl.viewingPrevious = false;
            ctrl.startRendering();
        }
    };

    ctrl.moveLog = function(){
        console.log("Applying Move");
        var newScope = $scope.$new(true, $scope);
        newScope.events =  ctrl.game.events;
        var loading = $mdDialog.show({
            scope: newScope,
            controller: DialogController,
            templateUrl: 'static/partials/MoveHistoryModal.html',
            parent: angular.element(document.body),
            clickOutsideToClose:true
        });

    };

    ctrl.showEndScreen = function(){
        $mdDialog.cancel(); // Cancel Any Pending Modals....
        var newScope = $scope.$new(true, $scope);
        newScope.winner =  ctrl.game.winner;
        newScope.nextGame = ctrl.nextGame;
        newScope.canCreate = ctrl.side != 'observer';
        //TODO: If not next game create next game...

        var endScreen = $mdDialog.show({
            scope: newScope,
            controller: DialogController,
            templateUrl: 'static/partials/EndModal.html',
            parent: angular.element(document.body),
            clickOutsideToClose:true
        });
        endScreen.then(function() {
            if(newScope.nextGame == null){
                khetService.createGameWithModal({
                    previousGame: gameID
                });
            }else{
                $window.location.href = '/#!/play?gameID='+encodeURI(newScope.nextGame);
                $window.location.reload();
            }

        }, function() {
            ctrl.playMove(0);
        });
    };

    // Get Initial Game....
    joinedGame.promise.then(function (){
        console.log("Get Game");
        khetService.getGame(gameID).then(function (r) {
            // Update To The Current Board...
            ctrl.game = r;
            update(ctrl.game,r.events.length-1);
            if(r.winner != 'blank'){
                ctrl.gameOver = true;
                ctrl.nextGame = r.linkedGameId;
                ctrl.showEndScreen();
            }else if(ctrl.gameStarted){
                soundService.endSound();
            }
        });
    });

    // Periodic Update (Observers & Two Player)
    // Update Next Game, if new just pop up...

    $interval(function () {
        // Don't Compound Calls...
        if(ctrl.updating == false && ctrl.game!= null &&  ctrl.game.events!= null){
            ctrl.updating = true;
            //Check to see if the event counts are the same. If they aren't we know an update has occurred.
            khetService.getGame(gameID, true).then(function (r) {
               if(r.count > ctrl.game.events.length){
                   //We can get the current game state
                   khetService.getGame(gameID).then(function (r) {
                       if(ctrl.nextGame == null && r.linkedGameId != null){
                           ctrl.nextGame = r.linkedGameId;
                           ctrl.showEndScreen();
                       }

                       ctrl.game = r;
                       ctrl.startRendering(); // Start rendering if not already doing so...
                       ctrl.updating = false;

                       if(r.events.length >= 2 && !ctrl.gameStarted){
                           $mdDialog.show(
                               $mdDialog.alert()
                                   .parent(angular.element(document.body))
                                   .clickOutsideToClose(true)
                                   .title('Opponent Has Joined')
                                   .textContent('Your Opponent Has Joined')
                                   .ariaLabel('Join Dialog')
                                   .ok('Got it!')
                           );
                           ctrl.gameStarted = true;
                           soundService.endSound();
                       }

                   });
               }else{
                   ctrl.updating = false;
               }
            });
        }
    }, UPDATE_RATE);

    return ctrl;
});

app.controller('HowToPlay', function ($location, $scope, $anchorScroll) {
    $scope.scrollTo = function(id) {
        console.log("SCROLL TO: "+id);
        var old = $location.hash();
        $location.hash(id);
        $anchorScroll();
        //reset to old to keep any additional routing logic from kicking in
        $location.hash(old);
    };
})
})();