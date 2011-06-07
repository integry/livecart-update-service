exports.collection = function()
{
	this.freePackages = [];

	this.loadReleasePackages();
	this.loadUpdatePackages();
	this.loadFreePackages();

	// caches
	this.initialVersion = {};
	this.newestVersions = {};
}

exports.collection.prototype =
{
	loadReleasePackages: function()
	{
		this.packages = {};
		var iniParser = require('iniparser');

		// versions/*/*.ini
		this.scanDirFiles(PKG_ROOT + '/versions/',
			function(file)
			{
				this.registerRelease(file, iniParser);
			}.bind(this));
	},

	loadUpdatePackages: function()
	{
		this.updates = {};

		// updates/*/*.tar.gz
		this.scanDirFiles(PKG_ROOT + '/updates/', this.registerUpdate.bind(this));
	},

	scanDirFiles: function(dir, fileCallback)
	{
		var fs = require('fs');
		fs.readdirSync(dir).forEach(function(name)
		{
			var pkgDir = dir + name;
			var files = fs.readdirSync(pkgDir);
			files.sort();
			files.forEach(function(file)
			{
				fileCallback({relPath: file, path:  pkgDir + '/' + file});
			});
		});
	},

	registerRelease: function(file, iniParser)
	{
		var versionMeta = iniParser.parseSync(file.path).Module;
		for (var k in versionMeta)
		{
			versionMeta[k] = versionMeta[k].replace(/\s*$/, '');
		}

		var name = versionMeta.pkg;

		if (!this.packages[name])
		{
			this.packages[name] = {};
		}

		if (!versionMeta.line)
		{
			versionMeta.line = 'current';
		}

		versionMeta.fileStat = require('fs').statSync(file.path);
		versionMeta.fileStat.ctimeStamp = Date.parse(versionMeta.fileStat.ctime) / 1000;

		versionMeta.tplDir = PKG_ROOT + '/templates/' + name + '/' + versionMeta.version;
		versionMeta.tplFiles = require('fs').readFileSync(versionMeta.tplDir + '/.list', 'UTF-8').split(/\n/).filter(function(el) { if (el) { return true; }});

		if (versionMeta.free)
		{
			if (!this.isFreePackage(name))
			{
				this.freePackages.push(name);
			}
		}

		this.packages[name][versionMeta.version] = versionMeta;
	},

	registerUpdate: function(file)
	{
		var parts = file.relPath.match(/(.*)\-([a-zA-Z0-9]+)\-(update|downgrade)\-(.*)\-to\-(.*)\.(zip|tar\.gz)/);
		if (!parts || ('zip' == parts[6]))
		{
			return;
		}

		var updateMeta = {
				package: parts[1],
				line: parts[2],
				from: parts[4],
				to: parts[5],
				type: parts[3],
				fileStat: require('fs').statSync(file.path),
				file: file.path
				}

		updateMeta.fileStat.ctimeStamp = Date.parse(updateMeta.fileStat.ctime) / 1000;

		this.updates[updateMeta.package] = this.updates[updateMeta.package] || {};
		this.updates[updateMeta.package][updateMeta.to] = this.updates[updateMeta.package][updateMeta.to] || [];
		this.updates[updateMeta.package][updateMeta.to].push(updateMeta);
	},

	loadFreePackages: function()
	{
		var that = this;
		for (var name in this.packages)
		{
			var pkg = this.packages[name];
			this.packages[name]
		};

		// determine which modules are free from product database
		var mysql = require('../helper/util.js').mysql();
		mysql.connect(function(err, results)
		{
			if (err)
			{
				mysql.end();
				throw err;
			}

			mysql.query("SELECT lft, rgt FROM Category WHERE Category.ID = ?", [MODULE_CATEGORY_ID],
			function(err, results, fields)
			{
				var row = results[0];

				mysql.query("SELECT identifier.value From Product " +
							"LEFT JOIN Category ON Product.categoryID=Category.ID " +
							"LEFT JOIN SpecificationStringValue AS identifier ON identifier.productID=Product.ID AND identifier.specFieldID=? " +
							"LEFT JOIN SpecificationItem AS licensable ON licensable.productID=Product.ID AND licensable.specFieldValueID=? " +
							"WHERE lft >= ? AND rgt <= ? AND licensable.specFieldValueID IS NULL", [IDENTIFIER_FIELD_ID, LICENSABLE_VALUE_ID, row.lft, row.rgt],
				function(err, results, fields)
				{
					results.forEach(function(row)
					{
						var match = row.value.match(/"en"(.*)\:"(.*?)"/);
						if (match)
						{
							that.freePackages.push(match[2]);
						}
					});

					mysql.end();
				});
			});

		});
	},

	getRelease: function(name, version)
	{
		return (this.packages[name] || {})[version];
	},

	getFreePackages: function()
	{
		return this.freePackages;
	},

	getPackageByName: function(name)
	{
		return this.getNewestVersion(name);
	},

	getPackageChannels: function(name)
	{
		if (!this.packages[name])
		{
			return [];
		}

		var channels = [];
		for (var version in this.packages[name])
		{
			var channel = this.packages[name][version].line;
			if (channels.indexOf(channel) < 0)
			{
				channels.push(channel);
			}
		};

		return channels;
	},

	getPackageVersions: function(name, channel)
	{
		if (!this.packages[name])
		{
			return [];
		}

		var versions = [];
		for (var version in this.packages[name])
		{
			if ((this.packages[name][version].line) == channel)
			{
				versions.push(this.packages[name][version]);
			}
		};

		return versions;
	},

	getUpdatePackages: function(name)
	{
		return this.updates[name];
	},

	getUpdatePackage: function(name, from, to)
	{
		var packages = this.getUpdatePackages(name);
		for (var v in packages)
		{
			for (var f = 0; f < packages[v].length; f++)
			{
				var p = packages[v][f];
				if ((p.from == from) && (p.to == to))
				{
					return p;
				}
			}
		}
	},

	getUpdatePath: function(name, fromVersion, toVersion)
	{
		var updates = this.updates[name];
		if (!updates || !updates[toVersion] || (fromVersion == toVersion))
		{
			return false;
		}

		var commonVersion = this.getCommonParentVersion(name, fromVersion, toVersion);
		if (!commonVersion)
		{
			return false;
		}

		// intermediate downgrade involved?
		if ([fromVersion, toVersion].indexOf(commonVersion) < 0)
		{
			return this.getUpdatePath(name, fromVersion, commonVersion).concat(this.getUpdatePath(name, commonVersion, toVersion));
		}

		var isUpdate = this.isUpdate(name, fromVersion, toVersion);

		// todo: prefer update packages that span across multiple versions, but we don't have those for now anyway
		var branch = this.packages[name][fromVersion].line || 'current';
		var package = updates[toVersion];
		var packages = [];

		while (package)
		{
			var prefered = null
			for (var p in package)
			{
				var pkg = package[p];
				if (pkg.type == (isUpdate ? 'update' : 'downgrade'))
				{
					// prefer to stay on the same branch
					if (branch == pkg.line)
					{
						prefered = package[p];
					}
					else if (!prefered)
					{
						prefered = pkg;
					}
				}
			}

			package = null;

			if (prefered)
			{
				packages.unshift(prefered);
				package = updates[prefered.from];
			}
		}

		// usually the update path starts via downgrade package, so this needs to be discarded
		if (packages[1] && (packages[1].from == fromVersion))
		{
			delete packages[0];

			// reindex
			packages = packages.filter(function() { return true; });
		}

		// no/incomplete update path
		if (packages[0] && (packages[0].from != fromVersion))
		{
			return false;
		}

		return packages;
	},

	/*
	 *  Strip private information from package data before returning it to client
	 */
	getClientPkgData: function(packages)
	{
		var ret = [];
		var keys = ['package', 'line', 'from', 'to', 'type'];
		for (var k = 0; k < packages.length; k++)
		{
			var p = {};
			for (var key = 0; key < keys.length; key++)
			{
				p[keys[key]] = packages[k][keys[key]];
			}

			ret.push(p);
		}

		return ret;
	},

	/* determine if update or downgrade path is requested
	 * return undefined if there's no direct update path (different branches)
	 */
	isUpdate: function(name, firstVersion, secondVersion)
	{
		var parent = this.getCommonParentVersion(name, firstVersion, secondVersion);
		if ([firstVersion, secondVersion].indexOf(parent) < 0)
		{
			return undefined;
		}

		return firstVersion == parent;
	},

	/* Sometimes there's no direct update/downgrade path when switching to a version from a different branch */
	getCommonParentVersion: function(name, firstVersion, secondVersion)
	{
		var rootVersion = this.getInitialPackageVersion(name);
		if ([firstVersion, secondVersion].indexOf(rootVersion) > -1)
		{
			return rootVersion;
		}

		var firstPath = this.getUpdatePath(name, rootVersion, firstVersion);
		var secondPath = this.getUpdatePath(name, rootVersion, secondVersion);

		if (!firstPath.length || !secondPath.length)
		{
			return false;
		}

		if (secondPath.length > firstPath.length)
		{
			var fp = firstPath;
			firstPath = secondPath;
			secondPath = fp;
		}

		for (var v in firstPath)
		{
			if (!secondPath[v] || (firstPath[v].to != secondPath[v].to))
			{
				return firstPath[v].from;
			}
		}
	},

	/* Initial version is the only version that cannot be updated to */
	getInitialPackageVersion: function(name)
	{
		if (this.initialVersion && this.initialVersion[name])
		{
			return this.initialVersion[name];
		}

		var updates = this.updates[name];
		if (!updates)
		{
			return false;
		}

		for (var to in updates)
		{
			var pkgs = updates[to];
			for (var p in pkgs)
			{
				var from = updates[pkgs[p].from];
				if (('update' == pkgs[p].type) && from)
				{
					var hasUpdate = false;
					for (var k in from)
					{
						if ('update' == from[k].type)
						{
							hasUpdate = true;
							break;
						}
					}

					if (!hasUpdate)
					{
						this.initialVersion[name] = pkgs[p].from;
						return this.initialVersion[name];
					}
				}
			}
		}
	},

	/* Newest version cannot be updated from */
	getNewestVersion: function(name, channel)
	{
		var pkgs = this.packages[name];
		if (!pkgs)
		{
			return false;
		}

		this.newestVersions[name] = this.newestVersions[name] || {};
		var n = this.newestVersions[name];

		if (!n.current)
		{
			for (var v in pkgs)
			{
				var pkg = pkgs[v];
				var newest = this.newestVersions[name][pkg.line];
				if (!newest || (newest.fileStat.ctimeStamp < pkg.fileStat.ctimeStamp))
				{
					n[pkg.line] = pkg;
				}
			}
		}

		if (channel && n[channel])
		{
			return n[channel];
		}
		else if (!channel)
		{
			return this.findNewestVersion(n);
		}

		return false;
	},

	findNewestVersion: function(array)
	{
		var newest = null;
		for (var k in array)
		{
			if (!newest || (array[k].fileStat.ctimeStamp > newest.fileStat.ctimeStamp))
			{
				newest = array[k];
			}
		}

		return newest;
	},

	isFreePackage: function(name)
	{
		return this.freePackages.indexOf(name) > -1;
	}
}