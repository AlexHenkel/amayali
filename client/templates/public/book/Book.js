import {scrollTop} from '../../../js/custom';

const verifyRequired = attributes => {
  let allSet = true;
  _.map(attributes, attr => {
    if(!Session.get(attr)) {
      allSet = false;
      return false;
    }
  });

  if(!allSet) Bert.alert(TAPi18n.__('book.errors.requiredInputs', null), 'danger');
  return allSet;
};

const nextInstance = (attributes, currInstance) => {
  if(!verifyRequired(attributes)) {
    Session.set('maxIntance', currInstance);
    return false;
  }

  // Increase steps
  Session.set('instance', currInstance + 1);
  // Increase max instance in case it was the first time advancing
  if(Session.get('maxIntance') === currInstance) Session.set('maxIntance', currInstance + 1);
  scrollTop();
};

const prevInstance = currInstance => {
  Session.set('instance', currInstance - 1);
  scrollTop();
};

Template.Book.onCreated(function () {
  let self = this;
	self.autorun(function() {
		self.subscribe('activeLocations');
	});
  Session.set('instance', 1);
	Session.set('maxIntance', 1);
  if(!Session.get('total')) Session.set('total', 0);

  // Get paypal env
  Meteor.call('getPaypalEnv', (err, res) => {
    if (err) {
      FlowRouter.reload();
    } else {
      Session.set('paypal_env', res);
    }
  })
});

export {nextInstance, prevInstance, verifyRequired}
