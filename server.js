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
		req.on('end', function() {  });

		var env = {response: res, request: req}
		req.parsed = require('url').parse(req.url, true);

		this.getHandshake(env);

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
			throw(e);
		}

		if (response)
		{
			this.processResponse(env, response);
		}
	},

	statusResponse: function(env, status, message)
	{
		this.processResponse(env, { status: status, msg: message || '' });
	},

	processResponse: function(env, response)
	{
		env.response.writeHead(response.status, {
			'Content-Type': 'text/plain'
		});
		env.response.write(response.msg);
		env.response.end();
	},

	getQuery: function(env)
	{
		return function(varName)
		{
			return this.getQueryVar(env, varName);
		}.bind(this);
	},

	getQueryVar: function(env, varName)
	{
		return env.request.parsed.query[varName];
	},

	getPackages: function()
	{
		return this.packages;
	},

	createHandshake: function(packages, domain)
	{
		var pc = this.getPackages();
		var allowedPackages = pc.getFreePackages();
		allowedPackages.push('livecart');

		var packageDetails = {}
		allowedPackages.forEach(function(pkg)
		{
			var packageInfo = {};
			pc.getPackageChannels(pkg).forEach(function(channel)
			{
				packageInfo[channel] = pc.getPackageByName(pkg, channel);
			});

			packageDetails[pkg] = packageInfo;
		}.bind(this));

		var cipher = require('crypto').createCipher('aes-256-cbc', HANDSHAKE_KEY + domain);
		var crypted = cipher.update(JSON.stringify(allowedPackages), 'utf8', 'hex');
		crypted += cipher.final('hex')

		return { packages: packageDetails, handshake: crypted, status: 'ok' }
	},

	getHandshake: function(env)
	{
		var handshake = this.getQueryVar(env, 'handshake');
		if (handshake)
		{
			var decipher = require('crypto').createDecipher('aes-256-cbc', HANDSHAKE_KEY + this.getQueryVar(env, 'domain'));
			var dec = decipher.update(handshake, 'hex', 'utf8');
			dec += decipher.final('utf8');
			env.allowedPackages = dec;
		}
	},

	getRequestRelease: function(env)
	{
		var name = this.getQueryVar(env, 'package');
		if (this.isPackageAllowed(env, name))
		{
			return this.packages.getRelease(name, this.getQueryVar(env, 'version'));
		}
		else
		{

		}
	},

	isPackageAllowed: function(env, name)
	{
		return this.packages.isFreePackage(name) || (env.allowedPackages && env.allowedPackages.indexOf(name) > -1);
	}
}

fc = new frontController();
require('http').createServer(fc.process.bind(fc)).listen(PORT, HOST);
require('sys').puts("Server at http://" + HOST + ':' + PORT.toString() + '/');

exports.fc = frontController;