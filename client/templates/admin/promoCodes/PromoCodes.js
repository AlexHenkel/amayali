Template.PromoCodes.onRendered(function() {
	let template = this;
	template.autorun(function() {
		template.subscribe('promoCodes', Session.get('currentCity'), () => {
			Tracker.afterFlush(() => {
				$("[data-sort=table]").tablesorter({
					sortList: [[0,0]],
					headers: {
						5: { sorter: false },
						6: { sorter: false },
						7: { sorter: false },
						8: { sorter: false },
						9: { sorter: false },
		      }
				});
			});
		});
	});
});

Template.PromoCodes.helpers({
	editItem: () => {
		return PromoCodes.findOne(Session.get('editId'));
	}
});
