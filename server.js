require('./config.js');

Function.prototype.bind = function(scope)
{
	var _this = this;
	return function()
	{
		return _this.apply(scope, arguments);
	}
}

var frontController = function()
{
	this.packages = new (require('./model/packageCollection').collection);
}

frontController.prototype =
{
	process: function(req, res)
	{
		var env = {response: res, request: req}

		req.parsed = require('url').parse(req.url, true);
		var routeParts = req.parsed.pathname.match(/([A-Z0-9a-z]+)/g);
		var controller = routeParts[0] || 'index';
		var action = routeParts[1] || 'index';

		try
		{
			var response = require('./controller/' + controller)[action](env);
		}
		catch (e)
		{
			console.log(e);
			var response = { status: 404, msg: 'Invalid request' }
		}

		if (response)
		{
			this.processResponse(env, response);
		}
	},

	statusResponse: function(env, status, message)
	{
		this.processResponse(env, { status: status, msg: message });
	},

	processResponse: function(env, response)
	{
		env.response.writeHead(response.status, {
			'Content-Type': 'text/plain'
		});
		env.response.write(response.msg);
		env.response.end();
	},

	getQueryVar: function(env, varName)
	{
		return env.request.parsed.query[varName];
	}
}

var fc = new frontController();
require('http').createServer(fc.process.bind(fc)).listen(PORT, HOST);
require('sys').puts("Server at http://" + HOST + ':' + PORT.toString() + '/');