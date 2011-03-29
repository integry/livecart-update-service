require('../config.js');

module.exports = require('nodeunit').testCase(
{
	setUp: function(callback)
	{
		this.packages = new (require('../model/packageCollection').collection);
		callback();
	},

	testUpdatePath: function(test)
	{
		test.ok(!this.packages.getUpdatePath('non-existing', '1.0.0', '1.0.1'));
		test.ok(!this.packages.getUpdatePath('test', '5.0.0', '3.0.1'));

		test.ok(this.packages.isUpdate('test', '1.0.0', '1.0.1'));
		test.ok(this.packages.isUpdate('test', '1.0.0', '1.0.0.1'));
		test.ok(!this.packages.isUpdate('test', '1.0.0.1', '1.0.0'));
		test.ok(!this.packages.isUpdate('test', '1.0.1', '1.0.0'));
		test.equal(this.packages.isUpdate('test', '1.0.0.1', '1.0.1'), undefined);

		// non-existing upgrade from/to versions
		test.ok(!this.packages.getUpdatePath('test', '1.0.0', '1.0.66'));

		test.ok(!this.packages.getUpdatePath('test', '1.0.0.66', '1.0.1'));

		var path = this.packages.getUpdatePath('test', '1.0.0', '1.0.1');
		test.equal(path.length, 1);
		test.equal(path[0].from, '1.0.0');
		test.equal(path[0].line, 'current');

		var path = this.packages.getUpdatePath('test', '1.0.0', '1.0.0.1');
		test.equal(path.length, 1);
		test.equal(path[0].from, '1.0.0');
		test.equal(path[0].to, '1.0.0.1');
		test.equal(path[0].line, 'stable');

		test.equal(this.packages.getInitialPackageVersion('test', '1.0.0'), '1.0.0');
		test.equal(this.packages.getCommonParentVersion('test', '1.0.1', '1.0.0.1'), '1.0.0');

		// simple downgrade
		var path = this.packages.getUpdatePath('test', '1.0.0.1', '1.0.0');
		test.equal(path.length, 1);
		test.equal(path[0].from, '1.0.0.1');
		test.equal(path[0].to, '1.0.0');
		test.equal(path[0].line, 'stable');

		// update across different branches and involves a downgrade
		var path = this.packages.getUpdatePath('test', '1.0.0.1', '1.0.1');
		test.equal(path.length, 2);
		test.equal(path[0].from, '1.0.0.1');
		test.equal(path[0].to, '1.0.0');
		test.equal(path[1].from, '1.0.0');
		test.equal(path[1].to, '1.0.1');

		test.done();
	}


});