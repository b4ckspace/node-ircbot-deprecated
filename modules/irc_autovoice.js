var LOGGER;
var CONFIG;

var MODULE_NAME = "AUTOVOICE";


var util = require("util");
var bot_;
var sanitize_regex = new RegExp('[^a-zA-Z]', 'g');

// Normalize nickname for better matching
function normalizeNick(nick) {
    return nick.replace(sanitize_regex, '').toLowerCase();
}

function inSpace(username) {

    // Checks if the username is currently in space, and exits
    // the loop if so
    return bot_._bckspcapi.getMembers().some(function(value, key) {
        if(normalizeNick(value) == normalizeNick(username)) {
            return true;
        }
    });
};

function setAllChans() {
    for(var channel in bot_.topics){
        setVoices(channel);
    }
}

var buffer = {};
var buffered = false;
var bufferVoice = function(channel, user, mode) {
    buffer[channel+user] = {    channel : channel,
                                user : user,
                                mode : mode };
    if(!buffered){
        buffered = true;
        setTimeout(sendBuffer, 100);
    }
};
var sendBuffer = function(){
    for(var k in buffer){
        var info = buffer[k];
        bot_.irc_client.send('mode', info.channel, info.mode, info.user)
    }
    buffer = {};
    buffered = false;
};

var setVoices = function(channel){
    if(!bot_._bckspcapi.isReady()){
        return
    }
    bot_.irc_client.once('names'+channel, function(names){

        // Iterate all names inside the channel and check if the nick is voiced or not
        for(var username in names) {

            var is_voiced = (names[username].indexOf("+") != -1);
            var in_space = inSpace(username);

            // Check if user is voiced but not in space anymore
            if(is_voiced && !in_space) {
                LOGGER.debug("user has voice, but not in space: %s", username);
                bufferVoice(channel, username, '-v');
                // bot_.irc_client.send('mode', channel, '-v', username);
            }

            // Check if user is not voiced, but in space
            if(!is_voiced && in_space) {
                LOGGER.debug("user has no voice, but in space: %s", username);
                bufferVoice(channel, username, '+v');
                // bot_.irc_client.send('mode', channel, '+v', username);
            }
        }

    });

    bot_.irc_client.send('names', channel);
};

module.exports = function(cfg, log, bot){

    LOGGER = log.getLogger(MODULE_NAME);
    CONFIG = cfg;
    bot_   = bot;

    bot.irc_client.on('join', function(channel, nick, message){
        LOGGER.debug("user %s joined chanel", nick, channel);
        setVoices(channel);
    });

    bot._bckspcapi.on('start', function(){
        LOGGER.debug('api is ready!');
        setAllChans();
    });

    bot._bckspcapi.on('join', function(member){
        LOGGER.debug('member join: %s', member);
        setAllChans();
    });

    bot._bckspcapi.on('part', function(member){
        LOGGER.debug('member part: %s', member);
        setAllChans();
    });

    bot.irc_client.on('+mode', function(channel, by, mode, arg, msg){
        if(mode!='o'){
            LOGGER.debug('got op +modechange: %s, %s, %s, %s, %s', channel, by, mode, arg, msg);
            return;
        }
        LOGGER.debug('+modechange: %s, %s, %s, %s, %s', channel, by, mode, arg, msg);
        // setVoices(channel);
    });

    // bot.irc_client.on('-mode', function(channel, by, mode, arg, msg){
    //     if(by==bot.nick)
    //         return;
    //     LOGGER.debug('-modechange: %s, %s, %s, %s, %s', channel, by, mode, arg, msg);
    //     setVoices(channel);
    // });

    bot.irc_client.on('nick', function(oldnick, newnick, channels){
        LOGGER.debug('nickchange: %s -> %s', oldnick, newnick);
        for(i in channels){
            setVoices(channels[i]);
        }
    });
    return {commands:[]};
};

