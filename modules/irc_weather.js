var FILTERS = {};
var COMMANDS = {};
var LOGGER;
var CONFIG;

var MODULE_NAME = "WEATHER";

var util = require('util');
var http = require('http');
var sprintf = require('sprintf').sprintf;

var town = 'Bamberg,Germany';
var weatherbase = 'http://api.openweathermap.org/data/2.1/find/name?q=';
var currentweather = undefined;
var fetchTimeout = 5 * 60 * 1000;

var updateWeather = function(){
    fetchWeatherByName("Bamberg, Germany", function(res){
        currentweather=res;
    });
    setTimeout(updateWeather, fetchTimeout);
};

var fetchWeatherByName = function(term, callback){
    var url = weatherbase + encodeURIComponent(term);
    LOGGER.debug("fetch new data. url: %s", url);
    http.get(url, function(res){
        var resString = '';
        res.setEncoding('utf8');
        res.on( 'data', function( data ) {
            resString += data;
        } );
        res.on('end', function(){
            var status;
            try{
                status = JSON.parse(resString);
            }catch(e){
                LOGGER.error("json parse error: " + e.message + " dta: " + JSON.stringify(resString));
                return;
            }
            if(status.message){
                LOGGER.warn("api error: %s for search '%s'", status.message, term);
                callback('error: "' + status.message + '"');
                return;
            }
            var temp = status.list[0].main.temp - 273.15; //temp is in kelvin
            var weather = status.list[0].weather[0].main;
            var link = status.list[0].url;
            var realtown = status.list[0].name;
            var realcountry = status.list[0].sys.country;
            var ret = sprintf("weather for %s, %s: %s (%.2f°C) more: %s", realtown, realcountry, weather, temp, link);
            callback(ret);
        });
    }).on('error', function(e) {
        callback("api error.")
        LOGGER.error("Got http status error error: " + e.message);
    });
};


(COMMANDS['!weather'] = function(sender, to){
    var term = Array.prototype.slice.call(arguments, 2).join(' ');
    if(!term){
        if(currentweather){
            this.reply(sender, to, currentweather);
        }else{
            this.reply(sender, to, "no weather data fetched yet.");
        }
        return
    }
    if(term.match(/b[a4]ckspace/i))
        term = "Bamberg, Germany";
    var that = this;
    fetchWeatherByName(term, function(res){
        that.reply(sender, to, res);
    })

}).helptext = "get current weather data. format: !weather town[,country].";

COMMANDS['!wetter'] = COMMANDS['!weather'];

module.exports = function(cfg, log, bot){
    LOGGER = log.getLogger(MODULE_NAME);
    CONFIG = cfg;
    updateWeather();
    for(key in FILTERS){
        bot.filters[key] = FILTERS[key];
    }
    return {commands:COMMANDS};
};