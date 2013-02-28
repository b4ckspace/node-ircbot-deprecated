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
    fetchWeatherByName("Bamberg", "Germany", function(res){
        currentweather=res;
    });
    setTimeout(updateWeather, fetchTimeout);
};

var fetchWeatherByName = function(town, country, callback){
    if(!town)
        town="Bamberg";
    if(!country)
        country="Germany"
    var url = weatherbase + town + "," + country;
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
                LOGGER.error("json parse error: " + e.message);
                return;
            }
            if(status.message){
                LOGGER.warn("api error: %s for town, country: %s, %s", status.message, town, country);
                callback('error: "' + status.message + '"');
                return;
            }
            var temp = status.list[0].main.temp - 273.15; //temp is in kelvin
            var weather = status.list[0].weather[0].main;
            var link = status.list[0].url;
            var realtown = status.list[0].name;
            var realcountry = status.list[0].sys.country;
            var ret = sprintf("weather for %s, %s: %s (%.2f°C) more: %s",realtown, realcountry, weather, temp, link);
            callback(ret);
        });
    }).on('error', function(e) {
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
    var matches = term.split(',');
    var town = matches[0];
    var country=matches[1];
    if(!country){
        country="Germany";
    }else{
        country = country.match(/\w+[\s\w+]*\w+/)[0];
        if(!country)
            country="Germany";
    }
    town=town.match(/\w+[\s\w+]*\w+/)[0];
    var that = this;
    fetchWeatherByName(town, country, function(res){
        that.reply(sender, to, res);
    })

}).helptext = "get current weather data.";

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