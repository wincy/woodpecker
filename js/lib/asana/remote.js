define('asana/remote', ['jquery', 'oauth', 'locache', 'when', 'when/delay', 'when/pipeline'], function($, OAuth, locache, when, delay, pipeline) {
    when.delay = delay;
    when.pipeline = pipeline;
    var oauth = locache.get('oauth');
    if (!oauth) {
	OAuth.initialize('aV9aEYWyFPInmTnl7iXdJ-VtoKg');
	OAuth.popup('asana', function(error, result) {
	    locache.set('oauth', result);
	});
    }

    function request(url, params, method) {
	if (params == undefined) {
	    params = {};
	}
	if (method == undefined) {
	    method = 'GET';
	}
	// subtask patch
	var match = url.match('tasks/([^/]+)/tasks');
	if (method == 'GET' && match) {
	    url = 'tasks/' + match[1] + '/subtasks';
	}
	// task list sync patch
	if (method == 'GET' && url.match('workspaces/[^/]+/tasks')) {
	    params = {
		assignee: 'me',
		opt_fields: 'modified_at',
	    };
	}
	if (method == 'GET' && url.match('projects/[^/]+/tasks')) {
	    params = {
		opt_fields: 'modified_at',
	    };
	}
	if (method == 'GET' && url.match('tags/[^/]+/tasks')) {
	    params = {
		opt_fields: 'modified_at',
	    };
	}
	if (method == 'GET' && url.match('tasks/[^/]+/subtasks')) {
	    params = {
		opt_fields: 'modified_at',
	    };
	}
	return when.promise(function(resolve, reject) {
	    if (navigator.onLine) {
		var settings = {
		    url: 'https://app.asana.com/api/1.0/' + url,
		    data: params,
		    type: method,
		    timeout: 30000,
		    dataType: 'json',
		    headers: {
			Authorization: 'Bearer ' + locache.get('oauth').access_token,
		    },
		};
		$.ajax(settings).done(function(data) {
		    if (!data.data) {
			reject('data is not valid:' + JSON.stringify(data));
		    } else {
			resolve(data.data);
		    }
		}).fail(function(xhr, status, error) {
		    if (xhr.status == 429 || error == 'timeout') {
			var timeout = 0;
			if (xhr.status == 429) {
			    timeout = JSON.parse(xhr.responseText).retry_after * 1000;
			}
			when.delay(timeout).then(function() {
			    request(url, params, method).then(resolve, reject);
			})
		    } else {
			reject(xhr.responseText);
		    }
		});
	    } else {
		reject('offline now');
	    }
	});
    }

    function Remote(ns) {
	this.ns = ns;
    }

    Remote.prototype = {
	get: function(resource, data) {
	    var url = '';
	    if (this.ns) {
		url += this.ns + '/'
	    }
	    url += resource;
	    return request(url, data, 'GET');
	},
	create: function(resource, data) {
	    var url = '';
	    if (this.ns) {
		url += this.ns + '/'
	    }
	    url += resource;
	    return request(url, data, 'POST');
	},
	update: function(resource, data) {
	    var url = '';
	    if (this.ns) {
		url += this.ns + '/'
	    }
	    url += resource;
	    return request(url, data, 'PUT');
	},
	remove: function(resource) {
	    var url = '';
	    if (this.ns) {
		url += this.ns + '/'
	    }
	    url += resource;
	    return request(url, undefined, 'DELETE');
	},
    };

    Remote.test = function() {
	QUnit.asyncTest('Remote testing', function() {
	    return when.pipeline([
		function() {
		    return new Remote().get('users').then(function(users) {
			ok(users.length > 0, 'Remote: get users');
		    });
		},
		function() {
		    return new Remote().get('workspaces')
			.then(function(workspaces) {
			    return when.all(when.map(workspaces, function(workspace) {
				return new Remote('workspaces/' + workspace.id)
				    .get('users').then(function(users) {
					ok(users.length > 0,
					   sprintf('Remote(%s): get users',
						   workspaces[0].id));
				    });
			    }));
			});
		},
		start,
	    ]);
	});
    };

    return Remote;
});
