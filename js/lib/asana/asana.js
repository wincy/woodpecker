define("asana", ["jquery", "when", "qunit", "sprintf", "asana/model"], function($, when, QUnit, sprintf, Model) {
    var CONCURRENCY = 10;

    function array_concat(s, l) {
	return s.concat(l);
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

    Asana = function(ns) {
	this.ns = ns;
    }

    Asana.User = Model.extend(
    	['user', 'users'], {
    	    name: new Model.Field("string", true),
    	    email: new Model.Field("string", true),
    	});
    Asana.Subtask = Model.extend(
    	['task', 'tasks'], {
    	    name: new Model.Field("string"),
    	});
    Asana.Task = Model.extend(
    	['task', 'tasks'], {
    	    name: new Model.Field("string"),
    	    Subtask: new Model.Field(Subtask),
    	});
    Asana.Tag = Model.extend(
    	['tag', 'tags'], {
    	    name: new Model.Field("string", true),
    	    Task: new Model.Field(Task),
    	});
    Asana.Project = Model.extend(
    	['project', 'projects'], {
    	    name: new Model.Field("string", true),
    	    Task: new Model.Field(Task),
    	});
    Asana.Workspace = Model.extend(
    	['workspace', 'workspaces'], {
    	    name: new Model.Field("string", true),
    	    User: new Model.Field(User),
    	    Project: new Model.Field(Project),
    	    Task: new Model.Field(Task),
    	    Tag: new Model.Field(Tag),
    	});

    Asana.prototype = {
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
    }

    Asana.test = function() {
    	QUnit.asyncTest("Asana testing", function() {
    	    when.pipeline([
    		Workspace.sync,
    		Workspace.find,
    		function(workspaces) {
    		    return when.all(when.map(workspaces, function(workspace) {
    			return workspace.sync();
    		    }));
    		},
    		function() {
    		    return Workspace.get({name: 'Test'});
    		},
    		function(workspace) {
    		    ok(workspace, "Workspace 'Test' exists");
    		    return when.parallel([
    			workspace.User.sync,
    			workspace.Project.sync,
    			workspace.Task.sync,
    			workspace.Tag.sync,
    		    ]).then(function() {
    			return workspace;
    		    });
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
