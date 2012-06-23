var irc         = require('irc');
var util        = require('util');
var mpdSocket   = require('mpdsocket');
var mpd;
var nick        = 'bckspctest';
var ircclient   = new irc.Client('irc.freenode.net', nick, {
    channels: ['#bckspctest'],
});

/*IRC SETUP*/
ircclient.addListener('message', function (from, to, message) {
    console.log(from + ' => ' + to + ': ' + message);
    messageDispatcher(message, from, to);
});
ircclient.addListener('error', function(message){
    console.log('ERROR: '+ util.inspect(message));
});


/* MPD SETUP*/
var mpdInit = function(){
    mpd = new mpdSocket('10.1.20.5', '6600');
    mpd.on('close', function(){
        console.log("mpd socket closed. reconnecting");
        mpdInit();
    });
};
mpdInit();

/*code*/
var messageDispatcher=function(message, sender, to){
    var command=message.split(' ')[0];
    switch(command){
        case '!ping':
            commands.pong(sender,to);
        break;
        case '!np':
            commands.playing(sender,to);
        break;
        default:
            console.log('unknown command: ' + command);
        break;
    };
};

var sendToWho=function(sender, to){
    if(to[0]=='#'){ //via channel
        return to;
    }else{          //via query or notice
        return sender;
    }
};


var commands={
    pong :  function(sender, to){
                var message =  'pong'
                var sendto  =  sendToWho(sender, to);
                if(sendto == sender){
                    message = sender + " " + message;
                }

                ircclient.say(sendto, message);
            },
    playing : function(sender, to){
                var sendto  =  sendToWho(sender, to);
                try{
                    mpd.send('currentsong',function(info) {
                        
                        if(!info['_OK']){
                            console.log('mpdc not ok: '+util.inspect(info));
                            ircclient.say("mpd error :(");
                            return;
                        }
                        
                        var message="NP: " + info['Artist'] + ' - ' + info['Title'];
                            ircclient.say(sendto, message);
                    });
                }catch(e){ //connection lost
                    ircclient.say("no connection to mpd");
                    console.log('caught exception :( :');
                    console.log(util.inspect(e));
                }
            },
};