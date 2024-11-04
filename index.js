const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server,{
    cors:{
        origin: "http://localhost:3000"
    }
});

app.use(express.static('public'));

const rooms = {};

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('createGame', (roomName, playerName) => {
        
        if (!rooms[roomName]) {//currentPlayer is the socket id of the current player
            rooms[roomName] = { players: [], board: Array(9).fill(null), currentPlayer: null, playAgain: [], previousPlayer: null, roomName };//here we create a room
        }
        const room = rooms[roomName];
        if (room.players.length <= 2) {//else he won't join the room

            if(!room?.players.find(p=> p.id === socket.id)){
                socket.join(roomName);
                room.players.push({ id: socket.id, name: playerName });
                io.to(socket.id).emit("enteredRoom", roomName)
            }

            if (room.players.length === 1) {
                room.currentPlayer = room.players[0].id; // First player starts
                room.players[0].symbol = "X";
            }else{
                if(room?.previousPlayer){
                    room.players[1].symbol = room.previousPlayer.symbol;
                }else{
                    room.players[1].symbol = "O";
                }
            }

            io.to(roomName).emit('updateGame', room);
        }else{
            io.to(socket.id).emit("roomFull");
        }
    });

    socket.on('makeMove', (roomName, index) => {
        const room = rooms[roomName];
        if(room?.players.length === 2){
            if (room && room.board[index] === null && socket.id === room.currentPlayer) {//if this was my move and the selected cell is empty
                // room.board[index] = room.players.find(player => player.id === socket.id).name; //my name will supersede the "null" in the selected board idx
                room.board[index] = room.players.find(player => player.id === socket.id).symbol; //it's symbol
                room.currentPlayer = room.players[0].id === room.currentPlayer ? room.players[1].id : room.players[0].id;//this is like toggling
                io.to(roomName).emit('updateGame', room);
            }
        }else{
            console.log(`Number of players in room (${roomName}): ${room?.players?.length}`);
            io.to(socket.id).emit("notEnoughPlayers")
        }
    });

    socket.on("playAgain", (roomName, acceptance)=>{
        const room = rooms[roomName];
        if(!room?.playAgain.includes(socket.id) && room?.playAgain.length <= 2){
            const opponent = room.players.find(player => player.id !== socket.id);

            if(`${acceptance}` === `${true}`){
                room.playAgain.push(socket.id);
            }else{
                io.to(opponent?.id).emit("playAgainDeclined");
            }

            if(room.playAgain.length === 2){
                room.board = Array(9).fill(null);
                room.currentPlayer = room.playAgain[0];
                room.playAgain = [];
                io.to(roomName).emit('updateGame', room);
            }
        }
    })

    socket.on('disconnect', () => {
        console.log('A user disconnected');
        for (const roomName in rooms) {
            const room = rooms[roomName];

            room.previousPlayer = room.players.find(player => player.id === socket.id);

            room.players = room.players.filter(player => player.id !== socket.id);

            if (room.players.length === 0) {
                delete rooms[roomName];
            } else {

                if(room.board.every(cell => cell)){
                    io.to(room.players[0].id).emit("playAgainDeclined")
                } else if (room.currentPlayer === socket.id) {
                    // Set the current player to the next player
                    room.currentPlayer = room.players[0].id;
                    
                    // Emit to the new current player with the information of the previous player
                    if (room.previousPlayer) {
                        io.to(room.currentPlayer).emit('previousPlayer', room.previousPlayer);
                        
                    } else {
                        console.log('previousPlayer not found');
                    }
                }
            }
            io.to(roomName).emit('updateGame', room);
            
        }
    });


    // socket.on('reconnect', () => {
    //     console.log('A user reconnected');
    //     for (const roomName in rooms) {
    //         const room = rooms[roomName];
    
    //         // Check if the player was previously in this room
    //         const player = room.players.find(player => player.id === socket.id);
    //         if (player) {
    //             // Player is already part of the room
    //             return;
    //         }
    
    //         // Allow the player back into the room
    //         room.players.push({ id: socket.id });
            
    //         // Maintain the currentPlayer on reconnection
    //         io.to(roomName).emit('updateGame', room);
    //     }
    // });
});


server.listen(4000, () => {
    console.log('Server is running on port: 4000');
});