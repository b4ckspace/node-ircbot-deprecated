var util        = require("util");
var r           = require('rethinkdb');

var nStore      = require('nstore');
nStore          = nStore.extend(require('nstore/query')());



var db_dbname       = "ircbot";
var db_karmatable   = "karma";
var db_karmaalias   = "karmaalias";


var karma       = nStore.new('data/karma.db', function () {
    


karma.all(function(err, data){
    if (err) {
        throw err;
    }

    r.connect({host: 'localhost', port: 28015}, function(err, connection) {
        if(err)
            throw err;
        console.log(data)
        for(nick in data){
            (function(nick){
            var num = data[nick].karma;
            for(var i=0; i<num;i++){
                var from = "!system";
                var to = nick.toLowerCase();
                r.db("ircbot").table(db_karmatable).insert({
                    from:from,
                    to:to,
                    given:r.now()
                }).run(connection, function(err, result){
                    if(err)
                        throw err;
                    karma.remove(nick, function(err){});
                })

            }
            })(nick);
        }
    });
});

});