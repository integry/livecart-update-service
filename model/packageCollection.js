exports.collection = function()
{
	this.loadReleasePackages();
	this.loadUpdatePackages();
	this.buildUpdateTree();

	// caches
	this.initialVersion = {};
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
			fs.readdirSync(pkgDir).forEach(function(file)
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
				type: parts[3]
				}

		this.updates[updateMeta.package] = this.updates[updateMeta.package] || {};
		this.updates[updateMeta.package][updateMeta.to] = this.updates[updateMeta.package][updateMeta.to] || [];
		this.updates[updateMeta.package][updateMeta.to].push(updateMeta);
	},

	buildUpdateTree: function()
	{
		for (var name in this.updates)
		{
			for (var toVersion in this.updates[name])
			{
				for (var i in this.updates[name][toVersion])
				{
					var meta = this.updates[name][toVersion][i];
					if (this.updates[name][meta.from])
					{
						var from = this.updates[name][meta.from];
						for (var f in from)
						{
							from[f]['nextUpdates'] = from[f]['nextUpdates'] || []
							from[f]['nextUpdates'].push(meta);
						}
					}

					var fromPackage = this.packages[name][meta.from];
					if (fromPackage)
					{
						fromPackage['updates'] = fromPackage['updates'] || [];
						fromPackage['updates'].push(meta);
					}
				}
			}
		}
	},

	getPackageByName: function(name)
	{

	},

	getUpdatePackages: function(name)
	{

	},

	getAvailablePackages: function()
	{

	},

	getNewestVersion: function(name, channel)
	{

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
			for (var p in package)
			{
				var prefered = null
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

		// no/incomplete update path
		if (packages && (packages[0].from != fromVersion))
		{
			return false;
		}

		return packages;
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

		for (var v in firstPath)
		{
			if (firstPath[v].to != secondPath[v].to)
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

	getFreePackages: function()
	{

	}
}