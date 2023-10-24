const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors());
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/jogo.html');
});

app.get('/controle', (req, res) => {
    res.sendFile(__dirname + '/public/controle.html');
});

app.get('/administrador/reload', (req, res) => {
    process.exit(1);
});

let telaJogo = null;
let corridaIniciada = false;
let setIntervalInicioCorrida = null;
let coresDisponiveis = ['amarelo', 'azul', 'rosa', 'vermelho'];
let jogadores = new Map();

io.on('connection', (socket) => {
    socket.on('disconnect', () => {

        if(socket.id == telaJogo){

            io.sockets.sockets.forEach(socket => {
                socket.disconnect(true);
            });

            //Reinicia um novo jogo
            corridaIniciada = false;
            coresDisponiveis = ['amarelo', 'azul', 'rosa', 'vermelho'];
            jogadores = new Map();
            
            if(setIntervalInicioCorrida){
                clearInterval(setIntervalInicioCorrida);
                setIntervalInicioCorrida = null;
            }
        }

        if(jogadores.get(socket.id)) {
            coresDisponiveis.push(jogadores.get(socket.id).cor);
            jogadores.delete(socket.id);
        }

        io.sockets.emit("broadcasting", {
            type: 'qtdJogadores',
            value: jogadores.size
        });
        
        io.sockets.emit("jogadores", {
            type: 'remove',
            value: socket.id
        });
    });

    socket.on('telaJogo', (socketId) => {
        telaJogo = socketId;
    });

    socket.on('novoJogador', (socketId) => {
        if(corridaIniciada) {
            io.to(socket.id).emit("broadcasting", {
                type: 'mensagem',
                value: 'A corrida já está em andamento, aguarde a próxima partida.'
            });

            if(io.sockets.sockets.get(socket.id)){
                io.sockets.sockets.get(socket.id).disconnect(true);
                console.log("disconnect: ", socket.id);
            }
    
            return;
        }

        if(jogadores.size >= 4){

            console.log('limite atingido: ', socket.id);

            io.to(socket.id).emit("broadcasting", {
                type: 'mensagem',
                value: 'Limite de jogadores atingido: Apenas quatro jogadores são permitidos por vez.'
            });

            if(io.sockets.sockets.get(socket.id)){
                io.sockets.sockets.get(socket.id).disconnect(true);
                console.log("disconnect: ", socket.id);
            }
    
            return;
        }

        if(!jogadores.get(socketId)) {

            let corJogador = coresDisponiveis.pop();

            jogadores.set(socketId, {
                cor: corJogador,
                posicao: 92 //posicao inicial
            });

            io.to(socket.id).emit("corCarrinho", corJogador);
        }

        io.sockets.emit("broadcasting", {
            type: 'qtdJogadores',
            value: jogadores.size
        });
        
        io.sockets.emit("jogadores", {
            type: 'add',
            value: Array.from(jogadores)
        });
    });

    socket.on('iniciarCorrida', () => {
        if(!corridaIniciada){

            corridaIniciada = true;
            
            let contadorInicioCorrida = 5;

            if(!setIntervalInicioCorrida){
                setIntervalInicioCorrida = setInterval(() => {
    
                    if(contadorInicioCorrida <= 0){
    
                        io.sockets.emit("broadcasting", {
                            type: 'corridaIniciada'
                        });
    
                        if(setIntervalInicioCorrida){
                            clearInterval(setIntervalInicioCorrida);
                            setIntervalInicioCorrida = null;
                        }
                    }
    
                    if(contadorInicioCorrida > 0){
                        io.sockets.emit("broadcasting", {
                            type: 'contagemInicioCorrida',
                            value: contadorInicioCorrida
                        });
                    }
    
                    contadorInicioCorrida--;
                    
                }, 1000);
            }
        }
    });

    socket.on('correr', () => {
        if(corridaIniciada) {
            if(jogadores.get(socket.id)) {
                
                jogadores.get(socket.id).posicao -= 1;

                if(jogadores.get(socket.id).posicao <= 20){

                    let idGanhador = socket.id;

                    io.sockets.emit("ganhador", {
                        jogador: jogadores.get(idGanhador)
                    });

                    io.sockets.sockets.forEach(socketFimJogo => {
                        if(socketFimJogo.id == idGanhador){
                            io.to(socketFimJogo.id).emit("fimJogo", true);
                        }else{
                            io.to(socketFimJogo.id).emit("fimJogo", false);
                        }
                    });

                    io.sockets.sockets.forEach(socketDisconnect => {
                        socketDisconnect.disconnect(true);
                    });

                    //Reinicia um novo jogo
                    corridaIniciada = false;
                    coresDisponiveis = ['amarelo', 'azul', 'rosa', 'vermelho'];
                    jogadores = new Map();

                    if(setIntervalInicioCorrida){
                        clearInterval(setIntervalInicioCorrida);
                        setIntervalInicioCorrida = null;
                    }
                }

                io.sockets.emit("posicao", {
                    jogador: socket.id,
                    value: jogadores.get(socket.id) ? jogadores.get(socket.id).posicao : 0
                });
            }
        }
    });
});

const port = process.env.PORT || 80;

server.listen(port, () => {
    console.log(`Servidor Express ouvindo na porta ${port}`);
});
