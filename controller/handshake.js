exports.index = function(env)
{
	var domain = fc.getQueryVar(env, 'domain');

	if (!domain)
	{
		return fc.statusResponse(env, 403, 'Domain name missing')
	}

	if (DSN)
	{
		require('dns').resolve4('localhost' == domain ? '127.0.0.1' : domain,
			function(err, ips)
			{
				if (('localhost' != domain) && !ALLOW_LOCALHOST_ACCESS)
				{
					if (env.request.headers['x-real-ip'])
					{
						env.request.connection.remoteAddress = env.request.headers['x-real-ip'];
					}

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

					mysql.query("SELECT * FROM OrderedItemOption " +
								"LEFT JOIN OrderedItem ON OrderedItemOption.orderedItemID=OrderedItem.ID " +
								"LEFT JOIN Product ON OrderedItem.productID=Product.ID " +
								"LEFT JOIN SpecificationStringValue AS identifier ON (identifier.productID=Product.ID AND identifier.specFieldID=?) " +
								"WHERE optionText LIKE ?", [IDENTIFIER_FIELD_ID, '%' + domain + '%'],
						function(err, results, fields)
						{
							if (err || !results.length)
							{
								mysql.end();
								return fc.statusResponse(env, 403, 'There is no license with "' + domain + '" as the registered domain name');
							}

							var packages = [];
							results.forEach(function(row)
							{
								var match = row.value ? row.value.match(/"en"(.*)\:"(.*?)"/) : null;
								if (match)
								{
									packages.push(match[2]);
								}
							});

							mysql.end();

							fc.statusResponse(env, 200, JSON.stringify(fc.createHandshake(packages, domain)));
						});
				});
			});
	}
	else
	{
		fc.statusResponse(env, 200, JSON.stringify(fc.createHandshake(null, domain)));
	}
}