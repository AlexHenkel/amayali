import {verifyRequired} from '../public/book/Book';
import {datepickerSetup, rate_120, rate_90, verifySchedule} from '../../js/custom';

const requiredInputs = ['product', 'type', 'therapistsType', 'date'];

const getOrderDetails = () => {
    let orderDetails = {
        clientId: Session.get('clientId'),
        locationId: Session.get('locationId'),
        product: Session.get('product'),
        type: Session.get('type'),
        therapistsType: Session.get('therapistsType'),
        date: Session.get('date'),
        total: Session.get('total')
    };
    const promoCodeValid = Session.get('promoCodeValid');
    if (promoCodeValid) {
        orderDetails.promoCode = promoCodeValid.code;
    }
    const pendingPromos = Session.get('pendingPromos');
    if (pendingPromos) {
        orderDetails.referencePromos = pendingPromos;
    }
    return orderDetails;
};

const handleErrorPayment = () => {
    Bert.alert(TAPi18n.__('book.errors.payment', null), 'danger');
};

const postPayment = (withPaypal, res) => {
    let orderDetails = getOrderDetails();

    if (withPaypal) {
        // Add paypal id to order
        orderDetails.transactionId = res.id;
    }

    // Attempt to insert order and account
    Meteor.call('postPaymentClient', orderDetails, (err, res) => {
        if (err) {
            handleErrorPayment(err);
            return false;
        } else {
            resetOrderSession();
            FlowRouter.go('client-pending-orders');
        }
    });
};

// Make a call to the REST api to execute the payment
const executePaypal = actions => actions.payment.execute().then(res => postPayment(true, res));

const resetOrderSession = () => {
    const toReset = _.concat(requiredInputs, ['promoCodeValid', 'promoCode']);
    _.map(toReset, item => {
        Session.set(item, null);
    });
};

Template.BookNowClient.onCreated(function () {
    if (!Session.get('total')) Session.set('total', 0);
    let self = this;
    self.autorun(function () {
        self.subscribe('clientPromoCode');
    });

    // Get paypal env
    Meteor.call('getPaypalEnv', (err, res) => {
        if (err) {
            FlowRouter.reload();
        } else {
            Session.set('paypal_env', res);
        }
    });
});

Template.BookNowClientForm.onRendered(() => {
    datepickerSetup();
});

Template.BookNowClient.helpers({
    total: () => {
        let subTotal = Session.get('subTotal');
        const pendingPromos = Session.get('pendingPromos');
        const promoCode = Session.get('promoCodeValid');
        if (!subTotal) {
            Session.set('total', 0);
            return 0;
        }
        // Apply regular discount codes
        if (promoCode) {
            if (promoCode.type === 'amount') {
                subTotal -= promoCode.amount;
            } else {
                subTotal *= ((100 - promoCode.amount) * 0.01);
            }
        }
        // Apply pending promos
        if (pendingPromos) {
            subTotal -= pendingPromos * 140;
        }
        // Safe asign total
        const total = subTotal > 0 ? Math.round(subTotal) : 0;
        Session.set('total', total);
        return total;
    },
    setLocationId: locationId => {
        Session.set('locationId', locationId);
    },
    setPendingPromos: pendingPromos => {
        Session.set('pendingPromos', pendingPromos);
    },
    setClientId: clientId => {
        Session.set('clientId', clientId);
    }
});

Template.BookNowClientForm.helpers({
    types: () => _.map(['relax', 'decontracting', 'sport'], _id => {
        return {
            _id,
            name: () => TAPi18n.__(`schemas.orders.typeSelect.options.${_id}`, null)
        };
    }),
    therapistsType: () => _.map(['same', 'any', 'female', 'male'], _id => {
        return {
            _id,
            name: () => TAPi18n.__(`schemas.orders.therapistsTypeSelect.options.${_id}`, null)
        };
    }),
    products: () => _.map(['60', '90', '120'], _id => {
        return {
            _id,
            name: () => TAPi18n.__(`schemas.orders.productSelect.options.${_id}`, null)
        };
    })
});

Template.BookNowClient.events({
  'click .edit-data': () => {
    Session.set('editId', Meteor.userId());
    Session.set('editMode', 1);
    Meteor.setTimeout(function () {
      $("#edit-modal").modal('show');
    }, 500);
  },
});

Template.BookNowClientForm.events({
    'click #product button': event => {
        const product = $(event.target).attr('data-id');
        // Get selected location base rate
        const baseRate = Locations.findOne(Session.get('locationId')).base_rate;

        let price;
        switch (product) {
            case '60':
                // Set price to base rate
                price = baseRate;
                break;
            case '90':
                // Get price by formula
                price = rate_90(baseRate);
                break;
            case '120':
                // Get price by formula
                price = rate_120(baseRate);
                break;
            default:
        }
        Session.set('subTotal', price);
    },
    'change [name="pendingPromos"]': () => {
        const val = $('[name=\'pendingPromos\']:checked').val();
        if (val === 'no') {
            Session.set('pendingPromos', 0);
        } else {
            Session.set('pendingPromos', Number(val));
        }
    },
    'change [name="date"]': event => verifySchedule(event.target.value),
    'click #verifyPromo': () => {
        const code = Session.get('promoCode');
        Meteor.call('verifyPromoCode', code, Session.get('locationId'), (err, res) => {
            if (err || !res) {
                Bert.alert(TAPi18n.__('book.errors.wrongPromoCode', null), 'danger');
            } else {
                if (res.reference) {
                    Meteor.call('clientOrders', (err1, number) => {
                        if (err1 || number) {
                            Bert.alert(TAPi18n.__('book.errors.referenceErrorClient', null), 'danger');
                        } else {
                            Bert.alert(TAPi18n.__('book.errors.successPromoCode', null), 'success');
                            Session.set('promoCodeValid', res);
                        }
                    });
                } else {
                    Bert.alert(TAPi18n.__('book.errors.successPromoCode', null), 'success');
                    Session.set('promoCodeValid', res);
                }
            }
        });
    }
});

Template.BookNowClientPaypal.onRendered(() => {
    // Issue with client credentials https://github.com/paypal/paypal-checkout/issues/356
    const env = Session.get('paypal_env');
    paypal.Button.render({
        env,
        client: {
            sandbox: 'Ab6JnNhuMzjNDVhueResuMYTirMOwVkmajYwGoD0mACP_0i1VczPp1NQ8vKFJYZYG2X8w27gFJwRySmQ',
            production: 'AZCADNCbS-X7YzWstteXXP-6e-Mbmtt9QiGSNDH69y7a1QpsObsuVAW5o9fqQ1n9eg4nvGBM7uu_VmkT'
        },
        style: {
            label: 'checkout', // checkout | credit | pay
            size: 'responsive',    // small | medium | responsive
            shape: 'rect',     // pill | rect
            color: 'blue'      // gold | blue | silver
        },
        commit: true,
        payment: (data, actions) => {
            const orderDetails = getOrderDetails();
            if (!verifyRequired(requiredInputs) || !verifySchedule($('[name=\'date\']').val())) {
                return false;
            }
            return actions.payment.create({
                transactions: [{
                    amount: {
                        total: Session.get('total'),
                        currency: 'MXN'
                    },
                    description: `${orderDetails.product} + ${orderDetails.type}`
                }]
            }, {
                input_fields: {
                    no_shipping: 1
                }
            });
        },
        onError: (err) => {
            // Show an error page here, when an error occurs
            console.log('errr', err);
            handleErrorPayment({error: 'payment'});
        },
        onCancel: (data) => {
            console.log('CANCEL', data);
            handleErrorPayment({error: 'payment'});
        },
        onAuthorize: (data, actions) => {
            return executePaypal(actions);
        }
    }, '#paypal-button-container');
});

Template.BookNowClientPaypal.helpers({
    // If total is 0, payment should be skipped
    payWithPaypal: () => Session.get('total') > 0
});

Template.BookNowClientPaypal.events({
    'click #credit-pay': (e) => {
        e.preventDefault();
        getOrderDetails();
        if (!verifyRequired(requiredInputs) || !verifySchedule($('[name=\'date\']').val())) {
            return false;
        }
        Session.set('creditCardPayMode', true);
    },
    'click #cancel-credit': (e) => {
        e.preventDefault();
        Session.set('creditCardPayMode', false);
    }
});
