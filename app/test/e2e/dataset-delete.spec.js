const nock = require('nock');
const chai = require('chai');
const Dataset = require('models/dataset.model');
const { createDataset } = require('./utils');

const should = chai.should();

const { getTestServer } = require('./test-server');

const requester = getTestServer();

let cartoFakeDataset = null;

describe('Dataset delete tests', () => {

    before(async () => {
        if (process.env.NODE_ENV !== 'test') {
            throw Error(`Running the test suite with NODE_ENV ${process.env.NODE_ENV} may result in permanent data loss. Please use NODE_ENV=test.`);
        }

        nock.cleanAll();

        cartoFakeDataset = await new Dataset(createDataset('cartodb')).save();

    });


    /* Delete */
    it('Not authorized dataset deletion', async () => {
        const response = await requester
            .delete(`/api/v1/dataset/${cartoFakeDataset._id}?loggedUser=null`)
            .send();

        response.status.should.equal(401);
    });

    afterEach(() => {
        if (!nock.isDone()) {
            throw new Error(`Not all nock interceptors were used: ${nock.pendingMocks()}`);
        }
    });

    after(() => {
        Dataset.remove({}).exec();
    });
});
