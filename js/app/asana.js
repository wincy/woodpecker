define("app/asana", ["jquery", "when", "qunit", "sprintf", "stacktrace", "app/persistent"], function() {
    var CONCURRENCY = 10;

    function array_concat(s, l) {
	return s.concat(l);
    }

    function array_concat_unique(s, l) {
	l.forEach(function(i) {
	    if (s.indexOf(i) == -1) {
		s.push(i);
	    }
	})
	return s;
    }

    function bindAll(target, that) {
	var result = {};
	for (var key in target) {
	    if (typeof target[key] == 'function') {
		result[key] = target[key].bind(that);
	    } else {
		result[key] = that;
	    }
	}
	return result;
    }

    function rejectHandler(error) {
	if (this.info) {
	    console.log(this.info);
	}
	console.log(error);
	if (error && error.stack) {
	    console.log(error.stack);
	} else {
	    var trace = stacktrace();
            console.log(trace.join('\n'));
	}
	throw error;
    }

    Asana = function(ns) {
	this.ns = ns;
	this.User = bindAll(this.User, this);
	this.Tag = bindAll(this.Tag, this);
	this.Workspace = bindAll(this.Workspace, this);
	this.Project = bindAll(this.Project, this);
    }

    Asana.prototype = {
	delay: function (timeout) {
	    var p = when.promise(function(resolve, reject) {
		setTimeout(resolve, timeout);
	    });
	    return p;
	},
	request: function(url, params, method) {
	    var key = JSON.stringify({url: url, params: params, method: method});
	    full_url = this.ns + url;
	    if (params == undefined) {
		params = {};
	    }
	    if (method == undefined) {
		method = 'GET';
	    }
	    var promise = when.promise(function(resolve, reject) {
		if (navigator.onLine) {
		    $.ajax({
			url: full_url,
			data: params,
			type: method,
			timeout: 30000,
			dataType: 'json',
			// error: function(xhr, status, error) {
			// 	if (xhr.status == 429 || error == 'timeout') {
			// 	    console.log('will retry');
			// 	}
			// },
		    })
			.done(function(data, status, xhr) {
			    if (!data.data) {
				reject('data is not valid:' + JSON.stringify(data));
			    } else {
				resolve(data.data);
			    }
			})
			.fail(function(xhr, status, error) {
			    if (xhr.status == 429 || error == 'timeout') {
				var timeout = 0;
				if (xhr.status == 429) {
				    timeout = JSON.parse(xhr.responseText).retry_after * 1000;
				}
				asana.delay(timeout).then(function() {
				    asana.request(url, params, method)
					.then(function(data) {
					    this.resolve(data);
					}.bind(this), function(error) {
					    console.log('reject @ retry:', error);
					    this.reject(error);
					}.bind(this));
				}.bind({resolve: resolve, reject: reject}))
			    } else {
				console.log(xhr);
				console.log(error);
				reject(xhr.responseText);
			    }
			});
		} else {
		    reject('offline now');
		}
	    }.bind(this));
	    return promise;
	},
	sync: function() {
	    return when.sequence([
		// sync workspaces
		function() {
		    return this.Workspace.sync();
		}.bind(this),
		function() {
		    return when.all(when.map(this.Workspace.find(), function(workspace) {
			return workspace.sync();
		    }));
		}.bind(this),
		// sync users
		function() {
		    return when.all([
			this.User.sync(),
			when.all(when.map(this.Workspace.find(), function(workspace) {
			    return workspace.User.sync();
			})),
		    ]);
		}.bind(this),
		function() {
		    return when.all(when.map(this.User.find(), function(user) {
			return user.sync();
		    }));
		}.bind(this),
		// sync projects
		function() {
		    return when.all([
			this.Project.sync(),
			when.all(when.map(this.Workspace.find(), function(workspace) {
			    return workspace.Project.sync();
			})),
		    ]);
		}.bind(this),
		function() {
		    return when.all(when.map(this.Project.find(), function(project) {
			return project.sync();
		    }));
		}.bind(this),
		// sync tags
		function() {
		    return when.all([
			this.Tag.sync(),
			when.all(when.map(this.Workspace.find(), function(workspace) {
			    return workspace.Tag.sync();
			})),
		    ]);
		}.bind(this),
		function() {
		    return when.all(when.map(this.Tag.find(), function(tag) {
			return tag.sync();
		    }));
		}.bind(this),
		// sync tasks
		function() {
		    return when.all([
			when.all(when.map(
			    this.Workspace.find(),
			    when.guard(
				when.guard.n(CONCURRENCY),
				function(workspace) {
				    return workspace.Task.sync();
				}))),
			when.all(when.map(
			    this.Project.find(), 
			    when.guard(
				when.guard.n(CONCURRENCY),
				function(project) {
				    return project.Task.sync();
				}))),
			when.all(when.map(
			    this.Tag.find(),
			    when.guard(
				when.guard.n(CONCURRENCY),
				function(tag) {
				    return tag.Task.sync();
				}))),
		    ]);
		}.bind(this),
		function() {
		    return when.all([
			when.all(when.map(this.Workspace.find(), function(workspace) {
			    return when.all(
				when.map(
				    workspace.Task.find(),
				    when.guard(
					when.guard.n(CONCURRENCY),
					function(task) {
					    return task.sync().then(function() {
						return task.Subtask.sync();
					    });
					})))
			})),
			when.all(when.map(this.Project.find(), function(project) {
			    return when.all(
				when.map(
				    project.Task.find(),
				    when.guard(
					when.guard.n(CONCURRENCY),
					function(task) {
					    return task.sync().then(function() {
						return task.Subtask.sync();
					    });
					})))
			})),
			when.all(when.map(this.Tag.find(), function(tag) {
			    return when.all(
				when.map(
				    tag.Task.find(),
				    when.guard(
					when.guard.n(CONCURRENCY),
					function(task) {
					    return task.sync().then(function() {
						return task.Subtask.sync();
					    });
					})))
			})),
		    ]);
		}.bind(this),
		// sync stories
		// function() {
		//     return when.all([
		// 	when.all(when.map(this.Workspace.find(), function(workspace) {
		// 	    return when.all(
		// 		when.map(
		// 		    workspace.Task.find(),
		// 		    when.guard(
		// 			when.guard.n(CONCURRENCY),
		// 			function(task) {
		// 			    return task.Story.sync();
		// 			})))
		// 	})),
		// 	when.all(when.map(this.Project.find(), function(project) {
		// 	    return when.all(
		// 		when.map(
		// 		    project.Task.find(),
		// 		    when.guard(
		// 			when.guard.n(CONCURRENCY),
		// 			function(task) {
		// 			    return task.Story.sync();
		// 			})))
		// 	})),
		//     ]);
		// }.bind(this),
		// function() {
		//     return when.all([
		// 	when.all(when.map(this.Workspace.find(), function(workspace) {
		// 	    return when.all(
		// 		when.map(
		// 		    workspace.Task.find(),
		// 		    when.guard(
		// 			when.guard.n(CONCURRENCY),
		// 			function(task) {
		// 			    return when.map(
		// 				task.Story.find(),
		// 				when.guard(
		// 				    when.guard.n(CONCURRENCY),
		// 				    function(story) {
		// 					return story.sync();
		// 				    }));
		// 			})))
		// 	})),
		// 	when.all(when.map(this.Project.find(), function(project) {
		// 	    return when.all(
		// 		when.map(
		// 		    project.Task.find(),
		// 		    when.guard(
		// 			when.guard.n(CONCURRENCY),
		// 			function(task) {
		// 			    return when.map(
		// 				task.Story.find(),
		// 				when.guard(
		// 				    when.guard.n(CONCURRENCY),
		// 				    function(story) {
		// 					return story.sync();
		// 				    }));
		// 			})))
		// 	})),
		//     ]);
		// }.bind(this),
	    ]);
	},
	User: {
	    sync: function() {
		return asana.request('/users').then(function(data) {
		    return new Persistent().set('users', JSON.stringify(data));
		});
	    },
	    filter: function(conditions, load) {
		var klass = Asana.User;
		return when.reduce(when.map(
		    Object.keys(conditions),
		    function(key) {
			return new Index(klass.prototype.key + '.' + key,
					 klass.prototype.key + '.' + 'ids')
			    .smembers(conditions[key]);
		    }), array_concat_unique, [])
		    .then(function(ids) {
			var result = ids.map(function(id) {
			    return new klass(id);
			});
			if (load == true) {
			    return when.map(result, function(item) {
				return item.load();
			    });
			} else {
			    return result;
			}
		    });
	    },
	    get: function(conditions) {
		return this.User.filter(conditions).then(function(items) {
		    if (items.length == 1) {
			return items[0];
		    } else if (items.length == 0) {
			throw sprintf("User not found: %s",
				      JSON.stringif(conditions));
		    } else {
			throw sprintf("Multiple users found: %s", JSON.stringify(items));
		    }
		}.bind(this));
	    },
	    find: function(load) {
		return new Persistent().get('users')
		    .then(function(data) {
			return JSON.parse(data);
		    }, rejectHandler)
		    .then(function(items) {
			var result = items.map(function(item) {
			    return $.extend(new Asana.User(item.id), item);
			})
			if (load == true) {
			    return when.map(result, function(item) {
				return item.load();
			    });
			} else {
			    return result;
			}
		    }, rejectHandler);
	    },
	},
	Tag: {
	    sync: function() {
		return asana.request('/tags').then(function(data) {
		    return new Persistent().set('tags', JSON.stringify(data));
		});
	    },
	    filter: function(conditions, load) {
		var klass = Asana.Tag;
		return when.reduce(when.map(
		    Object.keys(conditions),
		    function(key) {
			return new Index(klass.prototype.key + '.' + key,
					 klass.prototype.key + '.' + 'ids')
			    .smembers(conditions[key]);
		    }), array_concat_unique, [])
		    .then(function(ids) {
			var result = ids.map(function(id) {
			    return new klass(id);
			});
			if (load == true) {
			    return when.map(result, function(item) {
				return item.load();
			    });
			} else {
			    return result;
			}
		    });
	    },
	    get: function(conditions) {
		return this.Tag.filter(conditions).then(function(items) {
		    if (items.length == 1) {
			return items[0];
		    } else if (items.length == 0) {
			throw sprintf("Tag not found: %s",
				      JSON.stringif(conditions));
		    } else {
			throw sprintf("Multiple tags found: %s", JSON.stringify(items));
		    }
		}.bind(this));
	    },
	    find: function(load) {
		return new Persistent().get('tags')
		    .then(function(data) {
			return JSON.parse(data);
		    }, rejectHandler)
		    .then(function(items) {
			var result = items.map(function(item) {
			    return $.extend(new Asana.Tag(item.id), item);
			})
			if (load == true) {
			    return when.map(result, function(item) {
				return item.load();
			    });
			} else {
			    return result;
			}
		    }, rejectHandler);
	    },
	},
	Workspace: {
	    sync: function() {
		return asana.request('/workspaces').then(function(data) {
		    return new Persistent().set('workspaces', JSON.stringify(data));
		});
	    },
	    filter: function(conditions, load) {
		var klass = Asana.Workspace;
		return when.reduce(when.map(
		    Object.keys(conditions),
		    function(key) {
			return new Index(klass.prototype.key + '.' + key,
					 klass.prototype.key + '.' + 'ids')
			    .smembers(conditions[key]);
		    }), array_concat_unique, [])
		    .then(function(ids) {
			var result = ids.map(function(id) {
			    return new klass(id);
			});
			if (load == true) {
			    return when.map(result, function(item) {
				return item.load();
			    });
			} else {
			    return result;
			}
		    });
	    },
	    get: function(conditions) {
		console.log(this);
		return this.Workspace.filter(conditions).then(function(items) {
		    if (items.length == 1) {
			return items[0];
		    } else if (items.length == 0) {
			throw sprintf("Workspace not found: %s",
				      JSON.stringif(conditions));
		    } else {
			throw sprintf("Multiple workspaces found: %s", JSON.stringify(items));
		    }
		}.bind(this));
	    },
	    find: function(load) {
		return new Persistent().get('workspaces')
		    .then(function(data) {
			return JSON.parse(data);
		    }, rejectHandler)
		    .then(function(items) {
			var result = items.map(function(item) {
			    return $.extend(new Asana.Workspace(item.id), item);
			})
			if (load == true) {
			    return when.map(result, function(item) {
				return item.load();
			    });
			} else {
			    return result;
			}
		    }, rejectHandler);
	    },
	},
	Project: {
	    sync: function() {
		return asana.request('/projects', {opt_fields: 'modified_at'})
		    .then(function(data) {
			return new Persistent().set('projects', JSON.stringify(data));
		    });
	    },
	    filter: function(conditions, load) {
		var klass = Asana.Project;
		return when.reduce(when.map(
		    Object.keys(conditions),
		    function(key) {
			return new Index(klass.prototype.key + '.' + key,
					 klass.prototype.key + '.' + 'ids')
			    .smembers(conditions[key]);
		    }), array_concat_unique, [])
		    .then(function(ids) {
			var result = ids.map(function(id) {
			    return new klass(id);
			});
			if (load == true) {
			    return when.map(result, function(item) {
				return item.load();
			    });
			} else {
			    return result;
			}
		    });
	    },
	    get: function(conditions) {
		return this.Project.filter(conditions).then(function(items) {
		    if (items.length == 1) {
			return items[0];
		    } else if (items.length == 0) {
			throw sprintf("Project not found: %s",
				      JSON.stringif(conditions));
		    } else {
			throw sprintf("Multiple projects found: %s", JSON.stringify(items));
		    }
		}.bind(this));
	    },
	    find: function(load) {
		return new Persistent().get('projects')
		    .then(function(data) {
			return JSON.parse(data);
		    }, rejectHandler)
		    .then(function(items) {
			var result = items.map(function(item) {
			    return $.extend(new Asana.Project(item.id), item);
			})
			if (load == true) {
			    return when.map(result, function(item) {
				return item.load();
			    });
			} else {
			    return result;
			}
		    }, rejectHandler);
	    },
	},
    }

    Asana.Workspace = function(id) {
	this.id = id;
	this.User = bindAll(this.User, this);
	this.Project = bindAll(this.Project, this);
	this.Task = bindAll(this.Task, this);
	this.Tag = bindAll(this.Tag, this);
    }

    Asana.Workspace.prototype = {
	INDEX_FIELDS: ['name'],
	key: 'workspaces',
	sync: function() {
	    return new Lock(this.key + '/' + this.id)
		.wait()
		.then(function(lock) {
		    return asana.request('/' + this.key + '/' + this.id)
			.then(function(data) {
			    return when.all([
				new Persistent(this.key)
				    .set(this.id, JSON.stringify(data)),
				when.all(when.map(Object.keys(data), function(key) {
				    if (this.INDEX_FIELDS.indexOf(key) != -1) {
					return new Index(this.key + '.' + key,
							 this.key + '.ids')
					    .sadd(data[key], data.id);
				    }
				}.bind(this)))
			    ]);
			}.bind(this), rejectHandler)
			.then(function() {
			    return this.load();
			}.bind(this), rejectHandler)
			.ensure(function() {
			    lock.release();
			});
		}.bind(this), rejectHandler);
	},
	load: function() {
	    return new Persistent(this.key).get(this.id)
		.then(function(data) {
		    return $.extend(this, JSON.parse(data));
		}.bind(this));
	},
	User: {
	    sync: function() {
		return asana.request('/' + this.key + '/' + this.id + '/users')
		    .then(function(data) {
			return new Persistent(this.key + '/' + this.id)
			    .set('users', JSON.stringify(data));
		    }.bind(this));
	    },
	    find: function(load) {
		return new Persistent('workspaces/' + this.id).get('users')
		    .then(function(data) {
			return JSON.parse(data);
		    }, rejectHandler)
		    .then(function(items) {
			var result = items.map(function(item) {
			    return $.extend(new Asana.User(item.id), item);
			})
			if (load == true) {
			    return when.map(result, function(item) {
				return item.load();
			    });
			} else {
			    return result;
			}
		    }, rejectHandler);
	    },
	},
	Project: {
	    sync: function() {
		return asana.request('/workspaces/' + this.id + '/projects',
				     {opt_fields: 'modified_at'})
		    .then(function(data) {
			return new Persistent('workspaces/' + this.id)
			    .set('projects', JSON.stringify(data));
		    }.bind(this));
	    },
	    get: function(conditions) {
		var klass = this.Project;
		return klass.find(true).then(function(items) {
		    var matched = items.filter(function(item) {
			return Object.keys(conditions).every(function(field) {
			    return conditions[field] == item[field];
			});
		    });
		    if (matched.length == 0) {
			return klass.create(conditions);
		    } else {
			return matched[0];
		    }
		})
	    },
	    create: function(data) {
		return asana.request(
		    '/workspaces/' + this.id + '/projects',
		    data,
		    'POST')
		    .then(function(data) {
			return new Persistent('projects')
			    .set(data.id, JSON.stringify(data))
			    .then(function() {
				return data;
			    }, rejectHandler);
		    }, rejectHandler)
		    .then(function(data) {
			return $.extend(new Asana.Project(data.id), data);
		    }, rejectHandler)
		    .then(function(item) {
			return item.sync(new Date(Date.parse(item.created_at)))
			    .then(function() {
				return this.sync(new Date()).then(function() {
				    return item;
				});
			    }.bind(this), rejectHandler);
		    }.bind(this), rejectHandler);
	    },
	    find: function(load) {
		return new Persistent(this.key + '/' + this.id).get('projects')
		    .then(function(data) {
			return JSON.parse(data);
		    }, rejectHandler)
		    .then(function(items) {
			var result = items.map(function(item) {
			    return $.extend(new Asana.Project(item.id), item);
			});
			if (load == true) {
			    return when.map(result, function(item) {
				return item.load();
			    });
			} else {
			    return result;
			}
		    }, rejectHandler);
	    },
	},
	Task: {
	    sync: function() {
		return asana.request('/workspaces/' + this.id + '/tasks',
				     {opt_fields: 'modified_at', assignee: 'me'})
		    .then(function(data) {
			return new Persistent('workspaces/' + this.id)
			    .set('tasks', JSON.stringify(data));
		    }.bind(this));
	    },
	    find: function(load) {
		return new Persistent('workspaces/' + this.id).get('tasks')
		    .then(function(data) {
			return JSON.parse(data);
		    }, rejectHandler)
		    .then(function(items) {
			var result = items.map(function(item) {
			    return $.extend(new Asana.Task(item.id), item);
			})
			if (load == true) {
			    return when.map(result, function(item) {
				return item.load();
			    });
			} else {
			    return result;
			}
		    }, rejectHandler);
	    },
	},
	Tag: {
	    sync: function() {
		return asana.request('/workspaces/' + this.id + '/tags')
		    .then(function(data) {
			return new Persistent('workspaces/' + this.id)
			    .set('tags', JSON.stringify(data));
		    }.bind(this));
	    },
	    get: function(conditions) {
		var klass = this.Tag;
		return klass.filter(conditions).then(function(item) {
		    if (!item) {
			return klass.create(conditions);
		    } else {
			return item;
		    }
		})
	    },
	    create: function(data) {
		return asana.request(
		    '/workspaces/' + this.id + '/tags',
		    data,
		    'POST')
		    .then(function(data) {
			return new Persistent('tags')
			    .set(data.id, JSON.stringify(data))
			    .then(function() {
				return data;
			    }, rejectHandler);
		    }, rejectHandler)
		    .then(function(data) {
			return $.extend(new Asana.Tag(data.id), data);
		    }, rejectHandler)
		    .then(function(item) {
			return item.sync(new Date(Date.parse(item.created_at)))
			    .then(function() {
				return this.sync(new Date()).then(function() {
				    return item;
				});
			    }.bind(this), rejectHandler);
		    }.bind(this), rejectHandler)
		    .then(function(item) {
			return new Index('tag.name', 'tag.id')
			    .set(item.name, item.id)
			    .then(function() {
				return item;
			    }, rejectHandler);
		    }, rejectHandler);
	    },
	    find: function(load) {
		return new Persistent(this.key + '/' + this.id).get('tags')
		    .then(function(data) {
			return JSON.parse(data);
		    }, rejectHandler)
		    .then(function(items) {
			var result = items.map(function(item) {
			    return $.extend(new Asana.Tag(item.id), item);
			})
			if (load == true) {
			    return when.map(result, function(item) {
				return item.load();
			    });
			} else {
			    return result;
			}
		    }, rejectHandler);
	    },
	    filter: function(conditions) {
		if (conditions.name) {
		    return new Index('tag.name', 'tag.id').get(conditions.name)
			.then(function(id) {
			    if (id) {
				return new Asana.Tag(id).load();
			    } else {
				return id;
			    }
			});
		} else {
		    throw "Filter not support yet."
		}
	    },
	},
    }

    Asana.Project = function(id) {
	this.key = 'projects';
	this.id = id;
	this.name = null;
	this.Task = bindAll(this.Task, this);
    }

    Asana.Project.prototype = {
	INDEX_FIELDS: ['name'],
	key: 'projects',
	sync: function() {
	    return new Lock(this.key + '/' + this.id).wait()
		.then(function(lock) {
		    return new Persistent(this.key)
			.outdated(this.id, new Date(Date.parse(this.modified_at)))
			.then(function(outdated) {
			    if (!outdated) {
				return this;
			    }
			    return asana.request('/' + this.key + '/' + this.id)
				.then(function(data) {
				    return when.all([
					new Persistent(this.key)
					    .set(this.id, JSON.stringify(data)),
					when.all(when.map(Object.keys(data), function(key) {
					    if (this.INDEX_FIELDS.indexOf(key) != -1) {
						return new Index(this.key + '.' + key,
								 this.key + '.ids')
						    .sadd(data[key], data.id);
					    }
					}.bind(this)))
				    ]);
				}.bind(this), rejectHandler)
				.then(function() {
				    return this.load();
				}.bind(this), rejectHandler);
			}.bind(this), rejectHandler)
			.ensure(function() {
			    lock.release();
			});
		}.bind(this), rejectHandler);
	},
	// sync: function(last_update, deep) {
	// 	return new Lock(this.key + '/' + this.id).wait().then(function(lock) {
	// 	return new Persistent(this.key).outdated(this.id, last_update)
	// 	    .then(function(outdated) {
	// 		if (!outdated) {
	// 		    return this;
	// 		}
	// 		return asana.request('/' + this.key + '/' + this.id)
	// 		    .then(function(data) {
	// 			new Persistent(this.key).set(this.id, JSON.stringify(data));
	// 			return data;
	// 		    }.bind(this), rejectHandler)
	// 		    .then(function(data) {
	// 			return $.extend(this, data);
	// 		    }.bind(this), rejectHandler);
	// 	    }.bind(this), rejectHandler)
	// 	    .then(function(item) {
	// 		if (!deep) {
	// 		    return this;
	// 		}
	// 		var ns = item.key + '/' + item.id;
	// 		return when.all([
	// 		    asana.request('/' + ns + '/' + 'tasks',
	// 				  {opt_fields: 'modified_at'})
	// 			.then(function(data) {
	// 			    return new Persistent(ns).modifiedAt('tasks')
	// 				.then(function(modified_at) {
	// 				    item.last_sync = modified_at;
	// 				}, rejectHandler).then(function() {
	// 				    return new Persistent(ns)
	// 					.set('tasks', JSON.stringify(data))
	// 					.then(function() {
	// 					    return data;
	// 					}, rejectHandler);
	// 				}, rejectHandler)
	// 			}, rejectHandler)
	// 			.then(function(subitems) {
	// 			    return when.all(subitems.filter(function(subitem) {
	// 				return new Date(Date.parse(subitem.modified_at)) > item.last_sync;
	// 			    }).map(function(subitem) {
	// 				return new Asana.Task(subitem.id).sync(
	// 				    new Date(Date.parse(subitem.modified_at)), false);
	// 			    }));
	// 			}, rejectHandler),
	// 		]).then(function() {
	// 		    return this;
	// 		}.bind(this), rejectHandler);
	// 	    }.bind(this), rejectHandler).ensure(function() {
	// 		lock.release();
	// 	    });
	// 	}.bind(this), rejectHandler);
	// },
	load: function() {
	    return new Persistent(this.key).get(this.id)
		.then(function(data) {
		    return $.extend(this, JSON.parse(data));
		}.bind(this));
	},
	Task: {
	    sync: function() {
		return asana.request('/projects/' + this.id + '/tasks',
				     {opt_fields: 'modified_at'})
		    .then(function(data) {
			return new Persistent('projects/' + this.id)
			    .set('tasks', JSON.stringify(data));
		    }.bind(this));
	    },
	    get: function(conditions) {
		var klass = this.Task;
		return klass.filter(conditions).then(function(item) {
		    if (!item) {
			return klass.create(conditions);
		    } else {
			return item;
		    }
		})
	    },
	    // getByName: function(name) {
	    //     if (this.id != asana.woodpecker.me.id) {
	    // 	console.log('cannot call Task.getByName');
	    //     }
	    //     var date = name.split('#')[0];
	    //     var index = name.split('#')[1];
	    //     var cache = locache.get(date);
	    //     if (date) {
	    // 	if (cache && cache[index]) {
	    // 	    return new Asana.Task(cache[index].id).load();
	    // 	} else {
	    // 	    return this.Task.create({
	    // 		name: name,
	    // 		assignee: 'me',
	    // 		assignee_status: 'today',
	    // 	    });
	    // 	}
	    //     }
	    // },
	    create: function(data) {
		data['workspace'] = this.workspace.id;
		data['projects[0]'] = this.id;
		return asana.request(
		    '/tasks',
		    data,
		    'POST')
		    .then(function(data) {
			return new Persistent('tasks')
			    .set(data.id, JSON.stringify(data))
			    .then(function() {
				return data;
			    }, rejectHandler);
		    }, rejectHandler)
		    .then(function(data) {
			return $.extend(new Asana.Task(data.id), data);
		    }, rejectHandler)
		    .then(function(item) {
			return item.sync(new Date(Date.parse(item.created_at)))
			    .then(function() {
				return this.sync(new Date()).then(function() {
				    return item;
				}, rejectHandler);
			    }.bind(this), rejectHandler);
		    }.bind(this), rejectHandler)
		    .then(function(item) {
			return new Index('task.name', 'task.id')
			    .set(item.name, item.id)
			    .then(function() {
				return item;
			    }, rejectHandler);
		    }, rejectHandler);
	    },
	    find: function(load) {
		return new Persistent(this.key + '/' + this.id).get('tasks')
		    .then(function(data) {
			return JSON.parse(data);
		    }, rejectHandler)
		    .then(function(items) {
			var result = items.map(function(item) {
			    return $.extend(new Asana.Task(item.id), item);
			})
			if (load == true) {
			    return when.map(result, function(item) {
				return item.load();
			    });
			} else {
			    return result;
			}
		    }, rejectHandler);
	    },
	    filter: function(conditions) {
		if (conditions.name) {
		    return new Index('task.name', 'task.id').get(conditions.name)
			.then(function(id) {
			    if (id) {
				return new Asana.Task(id).load();
			    } else {
				return id;
			    }
			});
		} else {
		    throw "Filter not support yet."
		}
	    },
	}
    }

    Asana.Task = function(id) {
	this.key = 'tasks';
	this.id = id;
	this.Story = bindAll(this.Story, this);
	this.Tag = bindAll(this.Tag, this);
	this.Subtask = bindAll(this.Subtask, this);
	this.Offspring = bindAll(this.Offspring, this);
	this.Ancestor = bindAll(this.Ancestor, this);
    }

    Asana.Task.prototype = {
	INDEX_FIELDS: ['name', 'assignee_status', 'completed'],
	key: 'tasks',
	sync: function(force) {
	    return new Lock(this.key + '/' + this.id).wait()
		.then(function(lock) {
		    return new Persistent(this.key)
			.outdated(this.id, new Date(Date.parse(this.modified_at)))
			.then(function(outdated) {
			    if (outdated || force == true) {
				return asana.request('/' + this.key + '/' + this.id)
				    .then(function(data) {
					return when.all([
					    new Persistent(this.key)
						.set(this.id, JSON.stringify(data)),
					    when.all(when.map(Object.keys(data), function(key) {
						if (this.INDEX_FIELDS.indexOf(key) != -1) {
						    return new Index(this.key + '.' + key,
								     this.key + '.ids')
							.sadd(data[key], data.id);
						}
					    }.bind(this)))
					]);
				    }.bind(this), rejectHandler)
				    .then(function() {
					return this.load();
				    }.bind(this), rejectHandler);
			    } else {
				return this;
			    }
			}.bind(this), rejectHandler)
			.ensure(function() {
			    lock.release();
			});
		}.bind(this), rejectHandler);
	},
	// sync: function(last_update, deep) {
	// 	return new Lock(this.key + '/' + this.id).wait().then(function(lock) {
	// 	return new Persistent(this.key).outdated(this.id, last_update)
	// 	    .then(function(outdated) {
	// 		if (!outdated) {
	// 		    return this;
	// 		}
	// 		return asana.request('/' + this.key + '/' + this.id)
	// 		    .then(function(data) {
	// 			return when.all([
	// 			    new Persistent(this.key).set(this.id, JSON.stringify(data)),
	// 			    new Index('task.name', 'task.id').set(data.name, data.id),
	// 			]).then(function() {
	// 			    return data;
	// 			}, rejectHandler);
	// 		    }.bind(this), rejectHandler)
	// 		    .then(function(data) {
	// 			console.log('Sync:', this.key, this.id);
	// 			return $.extend(this, data);
	// 		    }.bind(this), rejectHandler);
	// 	    }.bind(this), rejectHandler)
	// 	    .then(function(item) {
	// 	    	if (!deep) {
	// 	    	    return this;
	// 	    	}
	// 	    	return when.all([
	// 	    	    asana.request('/' + item.key + '/' + item.id + '/' + 'stories',
	// 	    	    		  {opt_fields: 'created_at'})
	// 	    	    	.then(function(data) {
	// 	    	    	    return new Persistent(item.key + '/' + item.id)
	// 	    	    		.set('tasks', JSON.stringify(data))
	// 	    	    		.then(function() {
	// 	    	    		    return data;
	// 	    	    		}, rejectHandler);
	// 	    	    	}, rejectHandler)
	// 	    	    	.then(function(items) {
	// 	    	    	    return when.all(items.map(function(item) {
	// 	    	    		return new Asana.Story(item.id).sync(
	// 	    	    		    new Date(Date.parse(item.created_at)),
	// 				    false);
	// 	    	    	    }));
	// 	    	    	}, rejectHandler),
	// 	    	    asana.request('/' + item.key + '/' + item.id + '/' + 'tags',
	// 	    	    		  {opt_fields: 'created_at'})
	// 	    	    	.then(function(data) {
	// 	    	    	    return new Persistent(item.key + '/' + item.id)
	// 	    	    		.set('tags', JSON.stringify(data))
	// 	    	    		.then(function() {
	// 	    	    		    return data;
	// 	    	    		}, rejectHandler);
	// 	    	    	}, rejectHandler)
	// 	    	    	.then(function(items) {
	// 	    	    	    return when.all(items.map(function(item) {
	// 	    	    		return new Asana.Tag(item.id).sync(
	// 	    	    		    new Date(Date.parse(item.created_at)),
	// 				    false);
	// 	    	    	    }));
	// 	    	    	}, rejectHandler),
	// 	    	    asana.request('/' + item.key + '/' + item.id + '/' + 'subtasks',
	// 	    	    		  {opt_fields: 'modified_at'})
	// 	    	    	.then(function(data) {
	// 	    	    	    return new Persistent(item.key + '/' + item.id)
	// 	    	    		.set('subtasks', JSON.stringify(data))
	// 	    	    		.then(function() {
	// 	    	    		    return data;
	// 	    	    		}, rejectHandler);
	// 	    	    	}, rejectHandler)
	// 	    	    	.then(function(items) {
	// 	    	    	    return when.all(items.map(function(item) {
	// 	    	    		return new Asana.Task(item.id).sync(
	// 	    	    		    new Date(Date.parse(item.modified_at)),
	// 				    true);
	// 	    	    	    }));
	// 	    	    	}, rejectHandler),
	// 	    	]).then(function() {
	// 	    	    return this;
	// 	    	}.bind(this), rejectHandler);
	// 	    }.bind(this), rejectHandler).ensure(function() {
	// 		lock.release();
	// 	    });
	// 	}.bind(this), rejectHandler);
	// },
	load: function() {
	    return new Persistent(this.key).get(this.id)
		.then(function(data) {
		    $.extend(this, JSON.parse(data));
		    return when.all(when.map(this.tags, function(tag) {
			return new Asana.Tag(tag.id).load();
		    })).then(function(tags) {
			this.tags = tags;
			return this;
		    }.bind(this));
		}.bind(this));
	},
	update: function(kvs) {
	    return asana.request('/tasks/' + this.id, kvs, 'PUT')
		.then(function(data) {
		    new Persistent('tasks').set(data.id, JSON.stringify(data));
		    return data;
		}, rejectHandler)
		.then(function(data) {
		    return $.extend(this, data);
		}.bind(this), rejectHandler);
	},
	addTag: function(tag) {
	    return asana.request('/tasks/' + this.id + '/addTag', {tag: tag.id}, 'POST');
	},
	removeTag: function(tag) {
	    return asana.request('/tasks/' + this.id + '/removeTag', {tag: tag.id}, 'POST');
	},
	useTime: function(recursive) {
	    if (recursive) {
		return when.all([
		    this.useTime(false),
		    this.Subtask.find().then(function(tasks) {
			return when.all(tasks.map(function(task) {
			    return task.useTime(true);
			})).then(function(time_list) {
			    return time_list.reduce(function(sum, time) {
				return sum + time;
			    }, 0);
			}, rejectHandler);
		    }, rejectHandler)
		]).then(function(time_list) {
		    return time_list.reduce(function(sum, time) {
			return sum + time;
		    }, 0);
		});
	    } else {
		return new Index('task.id', 'record.ids').smembers(this.id)
		    .then(function(record_ids) {
			return when.all(record_ids.map(function(id) {
			    return new Asana.Task(id).load();
			}));
		    })
		    .then(function(records) {
			return records.reduce(function(sum, record) {
			    var r = JSON.parse(record.notes);
			    return sum + (Date.parse(r.end) - Date.parse(r.start)) / 1000 / 60;
			}, 0);
		    }, rejectHandler);
	    }
	},
	Story: {
	    sync: function() {
		return asana.request('/tasks/' + this.id + '/stories',
				     {opt_fields: 'type'})
		    .then(function(data) {
			return new Persistent('tasks/' + this.id)
			    .set('stories', JSON.stringify(data));
		    }.bind(this));
	    },
	    create: function(data) {
		return asana.request(
		    '/tasks/' + this.id + '/stories',
		    data,
		    'POST')
		    .then(function(data) {
			return new Persistent('stories')
			    .set(data.id, JSON.stringify(data))
			    .then(function() {
				return data;
			    }, rejectHandler);
		    }, rejectHandler)
		    .then(function(data) {
			return $.extend(new Asana.Story(data.id), data);
		    }, rejectHandler)
		    .then(function(item) {
			return item.sync(new Date(Date.parse(item.created_at)))
			    .then(function() {
				// return this.sync(new Date()).then(function() {
				return item;
				// });
			    }.bind(this), rejectHandler);
		    }.bind(this), rejectHandler);
	    },
	    find: function(load) {
		return new Persistent(this.key + '/' + this.id).get('stories')
		    .then(function(data) {
			return JSON.parse(data);
		    }, rejectHandler)
		    .then(function(items) {
			var result = items.map(function(item) {
			    return $.extend(new Asana.Story(item.id), item);
			})
			if (load == true) {
			    return when.map(result, function(item) {
				return item.load();
			    });
			} else {
			    return result;
			}
		    }, rejectHandler);
	    },
	},
	Tag: {
	    sync: function() {
		return asana.request('/tasks/' + this.id + '/tags')
		    .then(function(data) {
			return new Persistent('tasks/' + this.id)
			    .set('tags', JSON.stringify(data));
		    }.bind(this));
	    },
	    find: function(load) {
		return new Persistent(this.key + '/' + this.id).get('tags')
		    .then(function(data) {
			return JSON.parse(data);
		    }, rejectHandler)
		    .then(function(items) {
			var result = items.map(function(item) {
			    return $.extend(new Asana.Tag(item.id), item);
			})
			if (load == true) {
			    return when.map(result, function(item) {
				return item.load();
			    });
			} else {
			    return result;
			}
		    }, rejectHandler);
	    },
	},
	Subtask: {
	    sync: function() {
		return new Persistent(this.key + '/' + this.id)
		    .outdated('subtasks', new Date(Date.parse(this.modified_at)))
		    .then(function(outdated) {
			if (!outdated) {
			    return;
			}
			return asana.request('/tasks/' + this.id + '/subtasks',
					     {opt_fields: 'modified_at'})
			    .then(function(data) {
				return new Persistent('tasks/' + this.id)
				    .set('subtasks', JSON.stringify(data));
			    }.bind(this));
		    }.bind(this));
	    },
	    find: function(load) {
		return new Persistent(this.key + '/' + this.id).get('subtasks')
		    .then(function(data) {
			return JSON.parse(data);
		    }, rejectHandler)
		    .then(function(items) {
			var result = items.map(function(item) {
			    return $.extend(new Asana.Task(item.id), item);
			})
			if (load == true) {
			    return when.map(result, function(item) {
				return item.load();
			    });
			} else {
			    return result;
			}
		    }, rejectHandler);
	    },
	},
	Ancestor: {
	    find: function() {
		if (!this.parent) {
		    return when.promise(function(resolve) {
			resolve([]);
		    });
		} else {
		    return new Asana.Task(this.parent.id).load()
			.then(function(task) {
			    return task.Ancestor.find().then(function(tasks) {
				tasks.push(task);
				return tasks;
			    });
			}, rejectHandler);
		}
	    },
	},
	Offspring: {
	    find: function() {
		return when.all(when.map(this.Subtask.find(), function(item) {
			return item.Offspring.find();
		    })).then(function(items) {
			if (items.length > 0) {
			    return [this, items];
			} else {
			    return this;
			}
		    }.bind(this), rejectHandler);
	    },
	}
    }

    Asana.Story = function(id) {
	this.key = 'stories';
	this.id = id;
    }

    Asana.Story.prototype = {
	INDEX_FIELDS: [],
	key: 'stories',
	sync: function() {
	    if (this.type == 'system') {
		return this;
	    }
	    return new Lock(this.key + '/' + this.id).wait()
		.then(function(lock) {
		    return new Persistent(this.key)
			.exists(function(exists) {
			    if (exists) {
				return this;
			    }
			    return asana.request('/' + this.key + '/' + this.id)
				.then(function(data) {
				    return when.all([
					new Persistent(this.key)
					    .set(this.id, JSON.stringify(data)),
					when.all(when.map(Object.keys(data), function(key) {
					    if (this.INDEX_FIELDS.indexOf(key) != -1) {
						return new Index(this.key + '.' + key,
								 this.key + '.ids')
						    .sadd(data[key], data.id);
					    }
					}.bind(this)))
				    ]);
				}.bind(this), rejectHandler)
				.then(function() {
				    return this.load();
				}.bind(this), rejectHandler);
			}.bind(this), rejectHandler)
			.ensure(function() {
			    lock.release();
			});
		}.bind(this), rejectHandler);
	},
	// sync: function(last_update, deep) {
	// 	return new Lock(this.key + '/' + this.id).wait().then(function(lock) {
	// 	return new Persistent(this.key).outdated(this.id, last_update)
	// 	    .then(function(outdated) {
	// 		if (!outdated) {
	// 		    return this;
	// 		}
	// 		return asana.request('/' + this.key + '/' + this.id)
	// 		    .then(function(data) {
	// 			new Persistent(this.key).set(this.id, JSON.stringify(data));
	// 			return data;
	// 		    }.bind(this), rejectHandler)
	// 		    .then(function(data) {
	// 			console.log('Sync:', this.key, this.id);
	// 			return $.extend(this, data);
	// 		    }.bind(this), rejectHandler);
	// 	    }.bind(this), rejectHandler).ensure(function() {
	// 		lock.release();
	// 	    });
	// 	}.bind(this), rejectHandler);
	// },
	load: function() {
	    return new Persistent(this.key).get(this.id)
		.then(function(data) {
		    return $.extend(this, JSON.parse(data));
		}.bind(this));
	},
    }

    Asana.User = function(id) {
	this.key = 'users';
	this.id = id;
    }

    Asana.User.prototype = {
	INDEX_FIELDS: ['email', 'name'],
	key: 'users',
	sync: function() {
	    return new Lock(this.key + '/' + this.id)
		.wait()
		.then(function(lock) {
		    return asana.request('/' + this.key + '/' + this.id)
			.then(function(data) {
			    return when.all([
				new Persistent(this.key)
				    .set(this.id, JSON.stringify(data)),
				when.all(when.map(Object.keys(data), function(key) {
				    if (this.INDEX_FIELDS.indexOf(key) != -1) {
					return new Index(this.key + '.' + key,
							 this.key + '.ids')
					    .sadd(data[key], data.id);
				    }
				}.bind(this)))
			    ]);
			}.bind(this), rejectHandler)
			.then(function() {
			    return this.load();
			}.bind(this), rejectHandler)
			.ensure(function() {
			    lock.release();
			});
		}.bind(this), rejectHandler);
	},
	load: function() {
	    return new Persistent(this.key).get(this.id)
		.then(function(data) {
		    return $.extend(this, JSON.parse(data));
		}.bind(this));
	},
    }

    Asana.Tag = function(id) {
	this.key = 'tags';
	this.id = id;
	this.Task = bindAll(this.Task, this);
    }

    Asana.Tag.prototype = {
	INDEX_FIELDS: ['name'],
	key: 'tags',
	sync: function() {
	    return new Lock(this.key + '/' + this.id)
		.wait()
		.then(function(lock) {
		    return asana.request('/' + this.key + '/' + this.id)
			.then(function(data) {
			    return when.all([
				new Persistent(this.key)
				    .set(this.id, JSON.stringify(data)),
				when.all(when.map(Object.keys(data), function(key) {
				    if (this.INDEX_FIELDS.indexOf(key) != -1) {
					return new Index(this.key + '.' + key,
							 this.key + '.ids')
					    .sadd(data[key], data.id);
				    }
				}.bind(this)))
			    ]);
			}.bind(this), rejectHandler)
			.then(function() {
			    return this.load();
			}.bind(this), rejectHandler)
			.ensure(function() {
			    lock.release();
			});
		}.bind(this), rejectHandler);
	},
	// sync: function(last_update, deep) {
	// 	return new Lock(this.key + '/' + this.id).wait().then(function(lock) {
	// 	return new Persistent(this.key).outdated(this.id, last_update)
	// 	    .then(function(outdated) {
	// 		if (!outdated) {
	// 		    return this;
	// 		}
	// 		return asana.request('/' + this.key + '/' + this.id)
	// 		    .then(function(data) {
	// 			new Persistent(this.key).set(this.id, JSON.stringify(data));
	// 			new Index('tag.name', 'tag.id').set(data.name, data.id);
	// 			return data;
	// 		    }.bind(this), rejectHandler)
	// 		    .then(function(data) {
	// 			console.log('Sync:', this.key, this.id);
	// 			return $.extend(this, data);
	// 		    }.bind(this), rejectHandler);
	// 	    }.bind(this), rejectHandler)
	// 	    .then(function(item) {
	// 	    	return when.all([
	// 	    	    asana.request('/' + item.key + '/' + item.id + '/' + 'tasks',
	// 	    			  {opt_fields: 'modified_at'})
	// 	    		.then(function(data) {
	// 	    		    return new Persistent(item.key + '/' + item.id)
	// 	    			.set('tasks', JSON.stringify(data))
	// 	    			.then(function() {
	// 	    			    return data;
	// 	    			}, rejectHandler);
	// 	    		}, rejectHandler)
	// 	    		.then(function(items) {
	// 	    		    return when.all(items.map(function(item) {
	// 	    			return new Asana.Task(item.id).sync(
	// 	    			    new Date(Date.parse(item.modified_at)));
	// 	    		    }));
	// 	    		}, rejectHandler),
	// 	    	]).then(function() {
	// 	    	    return this;
	// 	    	}.bind(this), rejectHandler);
	// 	    }.bind(this)).ensure(function() {
	// 		lock.release();
	// 	    });
	// 	}.bind(this), rejectHandler);
	// },
	load: function() {
	    return new Persistent(this.key).get(this.id)
		.then(function(data) {
		    return $.extend(this, JSON.parse(data));
		}.bind(this));
	},
	update: function(kvs) {
	    return asana.request('/tags/' + this.id, kvs, 'PUT')
		.then(function(data) {
		    new Persistent('tasks').set(data.id, JSON.stringify(data));
		    return data;
		}, rejectHandler)
		.then(function(data) {
		    return $.extend(this, data);
		}.bind(this), rejectHandler);
	},
	Task: {
	    sync: function() {
		return asana.request('/tags/' + this.id + '/tasks',
				     {opt_fields: 'modified_at'})
		    .then(function(data) {
			return new Persistent('tags/' + this.id)
			    .set('tasks', JSON.stringify(data));
		    }.bind(this));
	    },
	    find: function(load) {
		return new Persistent(this.key + '/' + this.id).get('tasks')
		    .then(function(data) {
			return JSON.parse(data);
		    }, rejectHandler)
		    .then(function(items) {
			var result = items.map(function(item) {
			    return $.extend(new Asana.Task(item.id), item);
			})
			if (load == true) {
			    return when.map(result, function(item) {
				return item.load();
			    });
			} else {
			    return result;
			}
		    }, rejectHandler);
	    },
	},
    }

    Asana.test = function() {
	QUnit.asyncTest("Asana sync test:", function() {
	    when.pipeline([
		asana.Workspace.sync,
		asana.Workspace.find,
		function(workspaces) {
		    return when.all(when.map(workspaces, function(workspace) {
			return workspace.sync();
		    }));
		},
		function() {
		    return asana.Workspace.get({name: 'Test'});
		},
		function(workspace) {
		    return when.parallel([
			workspace.User.sync,
			workspace.Project.sync,
			workspace.Task.sync,
			workspace.Tag.sync,
		    ]).then(function() {
			return workspace;
		    })
		},
		function(workspace) {
		    return when.reduce([
			when.reduce(when.map(workspace.Project.find(), function(project) {
			    return when.pipeline([
				project.sync.bind(project), // `this` will be lost in when.sequence
				project.Task.sync,
				project.Task.find,
			    ]);
			}), array_concat, []),
			when.reduce(when.map(workspace.Tag.find(), function(tag) {
			    return when.pipeline([
				tag.sync.bind(tag), // `this` will be lost in when.sequence
				tag.Task.sync,
				tag.Task.find,
			    ]);
			}), array_concat, []),
		    ], array_concat, []).then(function(tasks) {
			return tasks.reduce(function(s, task) {
			    if (s.indexOf(task.id) == -1) {
				s.push(task.id);
			    }
			    return s;
			}, []).map(function(id) {
			    return new Asana.Task(id);
			});
		    }).then(function(tasks) {
			return when.all(when.map(tasks, function(task) {
			    return task.sync();
			}));
		    }).then(function() {
			return workspace;
		    });
		},
		function(workspace) {
		    when.pipeline([
			// check project
			function() {
			    return true;
			},
			workspace.Project.find,
			function(projects) {
			    equal(projects.length, 1, "Only 1 project exists");
			    equal(projects[0].name, "project 0", "project name is 'project 0'");
			    return projects[0];
			},
			// check tasks
			function(project) {
			    return when.pipeline([
				function () {
				    return true;
				},
				project.Task.find,
				function(tasks) {
				    var names = tasks.map(function(task) {
					return task.name;
				    });
				    deepEqual(names.sort(),
					      ['task 0',
					       'task 0 subtask 0',
					       'task 0 subtask 1',
					       'task 0 subtask 2',
					       'task 0 subtask 1 subtask 0',
					       'task 0 subtask 1 subtask 1'].sort());
				},
			    ]);
			},
			// check tags
			function() {
			    return true;
			},
			workspace.Tag.find,
			function(tags) {
			    equal(tags.length, 3, 'Only 3 tags exist');
			    var names = tags.map(function(tag) {
				return tag.name;
			    });
			    deepEqual(names.sort(),
				      ['tag 0', 'tag 1', 'tag 2'].sort(),
				      "tag list correct");
			    // check tag tasks
			    tag_tasks = {'tag 0': ['task 0'],
					 'tag 1': ['task 0 subtask 0',
						   'task 0 subtask 1 subtask 0'],
					 'tag 2': ['task 0 subtask 1',
						   'task 0 subtask 1 subtask 1']}
			    return when.all(when.map(tags, function(tag) {
			    	return when.pipeline([
			    	    function() {
			    		return true;
			    	    },
			    	    tag.Task.find,
			    	    function(tasks) {
					var names = tasks.map(function(task) {
					    return task.name;
					});
					deepEqual(
					    names.sort(),
					    tag_tasks[tag.name].sort(),
					    sprintf("tag '%s' task list correct",
						    tag.name));
			    	    }
			    	]);
			    }));
			},
			start,
		    ], true);
		},
	    ]);
	});
    };

    return Asana;
})
