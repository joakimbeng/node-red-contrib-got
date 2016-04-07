import test from 'ava';
import nock from 'nock';
import gotNode from '../src/got';

const red = (config = {}) => {
	const _registered = new Map();
	const _listeners = new Map();
	const _receivers = [];
	return {
		nodes: {
			createNode(node) {
				node.on = (evt, cb) => {
					_listeners.set(evt, cb);
				};
				node.send = msg => {
					_receivers.forEach(cbs => cbs[0](msg));
					_receivers.length = 0;
				};
				node.error = err => {
					_receivers.forEach(cbs => cbs[1](err));
					_receivers.length = 0;
				};
				node.status = () => {};
			},
			registerType(name, Node) {
				_registered.set(name, new Node(config));
			}
		},
		_registered,
		_listeners,
		_emit(evt, msg) {
			if (_listeners.has(evt)) {
				return _listeners.get(evt)(msg);
			}
		},
		_receive() {
			return new Promise((resolve, reject) => {
				_receivers.push([resolve, reject]);
			});
		}
	};
};

test('type is registered', t => {
	const RED = red();
	gotNode(RED);
	t.ok(RED._registered.has('got'));
});

test('makes get request when method and payload are not set', async t => {
	const example = nock('http://example.com')
		.get('/')
		.reply(200, '<body>Lorem ipsum</body>', {
			'Content-Type': 'text/html'
		});
	const RED = red();
	gotNode(RED);
	const msg = {
		url: 'http://example.com',
		payload: null
	};
	const receiver = RED._receive();
	RED._emit('input', msg);
	await receiver;
	t.ok(example.isDone());
});

test('requests using the set method', async t => {
	const example = nock('http://example.com')
		.post('/')
		.reply(200, '<body>Lorem ipsum</body>', {
			'Content-Type': 'text/html'
		});
	const RED = red();
	gotNode(RED);
	const msg = {
		url: 'http://example.com',
		method: 'post',
		payload: null
	};
	const receiver = RED._receive();
	RED._emit('input', msg);
	await receiver;
	t.ok(example.isDone());
});

test('uses other message properties as options', async t => {
	const example = nock('http://example.com')
		.post('/')
		.reply(200, '{"a": true}', {
			'Content-Type': 'application/json'
		});
	const RED = red();
	gotNode(RED);
	const msg = {
		url: 'http://example.com',
		method: 'post',
		json: true,
		payload: null
	};
	const receiver = RED._receive();
	RED._emit('input', msg);
	const newMsg = await receiver;
	t.ok(example.isDone());
	t.ok(newMsg);
	t.ok(newMsg.payload);
	t.ok(newMsg.payload.a);
});

test('sends message even for non ok responses', async t => {
	const example = nock('http://example.com')
		.post('/')
		.reply(404, 'Can\'t find that!', {
			'Content-Type': 'text/plain'
		});
	const RED = red();
	gotNode(RED);
	const msg = {
		url: 'http://example.com',
		method: 'post',
		payload: null
	};
	const receiver = RED._receive();
	RED._emit('input', msg);
	const newMsg = await receiver;
	t.ok(example.isDone());
	t.ok(newMsg);
	t.is(newMsg.statusCode, 404);
	t.is(newMsg.statusMessage, 'Not Found');
});

test('errors when other non status code error occur', async t => {
	const RED = red();
	gotNode(RED);
	const msg = {
		url: 'http://example.com',
		method: 'post',
		json: true,
		payload: () => {}
	};
	try {
		const receiver = RED._receive();
		RED._emit('input', msg);
		await receiver;
		t.fail('Should have thrown!');
	} catch (err) {
		t.ok(/options\.body/.test(err.message));
	}
});
