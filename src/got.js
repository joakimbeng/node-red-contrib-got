'use strict';

module.exports = exports = function (RED) {
	const got = require('got');

	function GotNode(config) {
		RED.nodes.createNode(this, config);

		const timeout = config.timeout || 30 * 1000;

		this.on('input', msg => {
			this.status({fill: 'yellow', shape: 'dot', text: 'Requesting'});
			const body = msg.payload;
			const opts = Object.assign({timeout, body}, msg);
			delete opts.url;
			delete opts.payload;
			got(msg.url, opts)
				.then(res => {
					this.status({});
					this.send(Object.assign({}, msg, {
						headers: res.headers,
						statusCode: res.statusCode,
						statusMessage: res.statusMessage,
						payload: res.body
					}));
				})
				.catch(err => {
					if (err.statusCode) {
						this.status({});
						this.send(Object.assign({}, msg, {
							headers: {},
							statusCode: err.statusCode,
							statusMessage: err.statusMessage,
							payload: err.message
						}));
						return;
					}
					this.status({fill: 'red', shape: 'dot', text: err.message});
					this.error(err, msg);
				});
		});
	}
	RED.nodes.registerType('got', GotNode);
};
