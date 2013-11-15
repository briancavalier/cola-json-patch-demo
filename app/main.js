define(function(require) {

	var most = require('most');
	var when = require('when');
	var fluent = require('wire/config/fluent');
	var merge = require('wire/config/merge');
	var role = require('wire/query/role');
	var dom = require('wire/dom');
	var Rest = require('cola/data/Rest');
	var TodoController = require('./TodoController');
	var validate = require('cola/data/validate');
	var mediate = require('cola/mediate');
	var transaction = require('cola/data/transaction');
	var queue = require('cola/lib/queue');
	var reactiveCollection = require('cola/view/array');
	var reactiveModel = require('cola/view/model');
	var bindByAttr = require('cola/view/bind/byAttr');

	var validateTodo = require('./validateTodo');

	var config = fluent(function(config) {
		config
			.add('todos@model', function() {
				// Use regular http patch
//				return new Rest('todos', { patch: true });
				// Use JSON Patch
				return new Rest('todos', { jsonPatch: true });
			})

			.add('todos@controller', TodoController)

			.add('todos@view', ['qs'], function(qs) {
				return qs('.todo-list');
			})

			.add('todoFormNode', ['qs'], function(qs) {
				return qs('.todo-form');
			})



















			// Below this point, wire.next and cola.next should make most
			// everything automatic, but we're not there yet, so there's
			// lots of manual config for now.
			.add('todoList', ['@view', '@model'], function(todoListNode, todos) {
				// TODO: This will eventually be hidden/automatic
				return reactiveCollection(todoListNode, {
					sectionName: 'todos',
					sortBy: 'description',
					binder: bindByAttr(),
					metadata: todos.metadata
				});
			})
			.add('todoForm', ['todoFormNode', '@model'], function(todoFormNode, todos) {
				// TODO: This will eventually be hidden/automatic
				return reactiveModel(todoFormNode, {
					binder: bindByAttr(),
					proxy: todos.metadata.model
				});
			})
			.add('todos@mediator', ['@model', '@controller', 'todoList'], mediate)
			.add('@lifecycle', function() {
				// TODO: This will eventually be hidden/automatic
				// This lifecycle post-processor makes datasources transactional
				var tx = transaction(queue());
				return {
					postCreate: function(instance) {
						if(!isDatasource(instance)) {
							return instance;
						}

						return validate(validateChanges, tx(instance));

						function validateChanges(changes, metadata) {
							if(validateTodo) {
								changes.forEach(function(change) {
									validateTodo(change, metadata);
								});
							}
						}
					}
				}
			})
			.resolve(['qs', 'on', '@mediator', '@model', 'todoForm', 'todoFormNode', 'todoList', '@view'], function(qs, on, todoController, todos, todoForm, todoFormNode, todoList, todoListNode) {

				// All of this is temporary gunk
				// TODO: It will eventually be hidden by cola and/or wire
				on('submit', todoFormNode, function(e) {
					e.preventDefault();
					when(todoController.create(todoForm.get(e)), commitIfOnline)
						.done(todoFormNode.reset.bind(todoFormNode));
				});

				todoList.observe()
					.map(updateTransaction)
					.each(commitIfOnline);

				on('click:.remove', todoListNode, function(e) {
					when(todoController.remove(todoList.find(e))).done(commitIfOnline);
				});

				on('click:.remove-completed', todoFormNode, function(e) {
					when(todoController.removeCompleted(e)).done(commitIfOnline);
				});

				on('click:.complete-all', todoFormNode, function(e) {
					when(todoController.completeAll(e)).done(commitIfOnline);
				});

				// Do some very simple-minded online/offline checking
				var toggle = qs('.online-toggle');
				var online = toggle.checked && navigator.onLine;

				var windowOnline = most.fromEventTarget(window, 'online')
					.map(function () {
						return { online: toggle.checked, wasOffline: !online };
					});

				var windowOffline = most.fromEventTarget(window, 'offline')
					.map(function () {
						return { online: false, wasOffline: false };
					});

				var toggleOnline = most.fromEventTarget(toggle, 'change')
					.map(function (e) {
						return {
							online: e.target.checked && navigator.onLine,
							wasOffline: !online
						};
					});

				windowOnline.merge(windowOffline).merge(toggleOnline)
					.tap(function(status) { online = status.online; })
					.each(updateOnlineStatus);

				function updateOnlineStatus(status) {
					if(status.online) {
						document.body.classList.remove('offline');
					} else {
						document.body.classList.add('offline');
					}

					if(status.online && status.wasOffline) {
						commitTransaction(true);
					}
				}

				function updateTransaction(changes) {
					return todos.update(changes);
				}

				function commitIfOnline(x) {
					return when(x, function() {
						return online ? commitTransaction() : when.resolve();
					});
				}

				function commitTransaction(refetch) {
					return todos.commit(refetch);
				}
			});
	});

	return merge([dom, config]);

	function isDatasource(instance) {
		return instance
			&& typeof instance.fetch === 'function'
			&& typeof instance.update === 'function'
			&& typeof instance.commit !== 'function';
	}
});