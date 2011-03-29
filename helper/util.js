export.mysql = function()
{
	mysql = new (require('mysql').Client);
	mysqlCred = require('url').parse(DSN);
	mysqlAuth = mysqlCred.auth.split(/\:/);
	mysql.user = mysqlAuth[0];
	mysql.password = mysqlAuth[1];
	mysql.host = mysqlCred.hostName;
	mysql.database = mysqlCred.path.substring(1);

	return mysql;
}