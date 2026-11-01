'use strict';

module.exports = {recoverPortConflict};

async function recoverPortConflict({probe, stopOwn, delay = ms => new Promise(resolve => setTimeout(resolve, ms))}) {
	let port = await probe();
	if (port?.owner !== 'other') return {port, retried:false, resolved:true};
	await stopOwn();
	await delay(250);
	port = await probe();
	return {port, retried:true, resolved:port?.owner !== 'other'};
}
