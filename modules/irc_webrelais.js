var FILTERS = {};
var COMMANDS = {};
var LOGGER;
var CONFIG;

var MODULE_NAME = "WEBRELAIS";

var webrelaisApi= require('../webrelais.js');
var webrelais   = new webrelaisApi.Client("https://webrelais.bckspc.de:443");
var alarmWait   = 60*1000;

var http = require('http');
var https = require('https');
var url    = require('url');

var alarm_blocked = false;
(COMMANDS['!alarm'] = function(sender, to) {
    if(!this.isChannel(sender, to)){
        this.reply(sender, to, "you can use !alarm only in channels.");
        LOGGER.info("alarm not in channel %s", sender);
        return;
    }
    if(alarm_blocked){
        this.reply(sender, to, "https://www.youtube.com/watch?v=TqDsMEOYA9g");
        LOGGER.info("alarm not ready %s %s", sender, to);
        return;
    }
    
    var args  = Array.prototype.slice.call(arguments);
    var message = "irc: " + args.slice(2).join(' ');

    var options     = url.parse('http://api.ledboard.bckspc.de/send_text?message='+message);
    options.method  = 'GET';
    options.headers = {'Content-length': 0};

    var http_s = options.protocol=='https:' ? https : http;

    LOGGER.info("sending message %s to api", message);
    // Set up the request
    var req = http_s.request(options, function(res){});
    req.end();

    alarm_blocked=true;
    setTimeout(function(){
        alarm_blocked = false;
        LOGGER.debug("alarm cooldown");
    }, alarmWait);
    var white = 3;
    var red   = 4;
    var light = 5;
    var on    = 1;
    var off   = 0;
    var waittime = 500;
    var old_white;
    var old_red;
    this.reply(sender, to, "alarm has been activated. backspace is now in defcon 2.");
    LOGGER.info("alarm in channel %s by user %s", to, sender);
    webrelais.set_port(light, on);
    setTimeout(function(){
        webrelais.set_port(light, off);
    }, 5000);
    webrelais.get_port(white, function(error, reply){
        old_white = reply.response ? on : off;
        webrelais.set_port(white, off);
        webrelais.get_port(red, function(error, reply){
            old_red = reply.response ? on : off;
            webrelais.set_port(red, off);
            webrelais.set_port(white, on, function(){
                setTimeout(function(){
                    webrelais.set_port(white, off);
                    webrelais.set_port(red, on, function(){
                        setTimeout(function(){
                            webrelais.set_port(red, off);
                            webrelais.set_port(white, on, function(){
                                setTimeout(function(){
                                    webrelais.set_port(white, old_white);
                                    webrelais.set_port(red, old_red);
                                }, waittime);
                            });
                        }, waittime);
                    });
                }, waittime);
            });
        })
    });
}).helptext = "flash the emergency light :)";

module.exports = function(cfg, log, bot){
    LOGGER = log.getLogger(MODULE_NAME);
    CONFIG = cfg;
    for(key in COMMANDS){
        bot.commands[key] = COMMANDS[key];
    }
    for(key in FILTERS){
        bot.filters[key] = FILTERS[key];
    }
};
