exports.index = function(env)
{
	var domain = fc.getQueryVar(env, 'domain');

	if (!domain)
	{
		return fc.statusResponse(env, 403, 'Domain name missing')
	}

	require('dns').resolve4(domain,
		function(err, ips)
		{
			if (('localhost' != domain) && !ALLOW_LOCALHOST_ACCESS)
			{
				if (err || (-1 == ips.indexOf(env.request.connection.remoteAddress)))
				{
					return fc.statusResponse(env, 403, 'Domain name does not match request IP address')
				}
			}

			var mysql = require('../helper/util.js').mysql();
			mysql.connect(function(err, results)
			{
				if (err)
				{
					throw err;
				}

				mysql.query("SELECT * From OrderedItemOption WHERE optionText LIKE ?", ['%' + domain],
					function(err, results, fields)
					{
						if (!results.length)
						{
							return fc.statusResponse(env, 403, 'There is no license with "' + domain + '" as the registered domain name');
						}

						var pc = fc.getPackages();
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

						var response = { packages: packageDetails, handshake: crypted, status: 'ok' }

						fc.statusResponse(env, 200, JSON.stringify(response));
					});
			});
		});
}