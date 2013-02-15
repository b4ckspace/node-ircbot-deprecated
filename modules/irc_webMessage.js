var FILTERS = {};
var COMMANDS = {};
var LOGGER;
var CONFIG;
var MODULE_NAME = "webMessage";

var http = require('http');
var util = require('util');

var initServer = function(nbot, cfg){
    var bot = nbot;
    var server = http.createServer();
    server.on('request', function(request, response){
        if(request.method.toUpperCase() != 'POST'){
            LOGGER.warn('invalid method: %s', request.method);
            response.writeHead(405);
            response.write(JSON.stringify({error:true}));
            response.end();
            return;
        }
        if(request.url != '/message'){
            LOGGER.warn('invalid path: %s', request.path);
            response.writeHead(404);
            response.write(JSON.stringify({error:true}));
            response.end();
            return;
        }
        var rawdata = '';
        request.on('data', function(data){
            rawdata+=data;
        });
        request.on('end', function(){
            var data;
            console.log(rawdata);
            try {
                data = JSON.parse(rawdata);
            }
            catch(e) {
                LOGGER.warn( 'json parsing error: ' + e.message );
                response.writeHead(400);
                response.write(JSON.stringify({error:true}));
                response.end();
                return;
            }
            if(data.passcode != cfg.webmessage_pass){
                response.writeHead(403);
                response.write(JSON.stringify({error:true}));
                return;
            }
            if( (!data.message) || (data.message == '') || (!data.to) || (data.to == '') ){
                LOGGER.warn('empty message or to field');
                response.writeHead(400);
                response.write(JSON.stringify({error:true}));
                response.end();
                return;
            }
            bot.irc_client.say(data.to, data.message);
            LOGGER.info('sending message "%s" to %s. useragent: %s',
                                    data.message, data.to,
                                    request.headers['user-agent']);
            response.writeHead(200);
            response.write(JSON.stringify({error:false}));
            response.end();
        });
    });
    var port     = CONFIG.webmessage_port;
    LOGGER.info('starting webMessage server. listening on port %s', port);
    server.listen(port);
};



module.exports = function(cfg, log, bot){
    LOGGER = log.getLogger(MODULE_NAME);
    CONFIG = cfg;
    initServer(bot);
};