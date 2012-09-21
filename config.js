/* copy this file to config.local.js and set it to correct values */

var nick        = env['nick']       || 'b4ckspace_bot';
var realname    = env['realname']   || 'b4ckspace_bot';
var username    = env['username']   || 'b4ckspace_bot';
var irc_server  = env['irc_server'] || 'irc.freenode.net';
var irc_port    = env['irc_port']   || 6667;
var ircpass     = env['irc_pass']   || undefined;
var secure      = env['irc_ssl']    == "true";
var ignoreSsl   = env['ssl_ignore'] == "true";
var channels    = (env['channels']  && env['channels'].split(','))||['#backspace'];
var disable_mpd = env['nompd']      != "true";
