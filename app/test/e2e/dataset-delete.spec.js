const ROLES = require('./test.constants').ROLES;
const nock = require('nock');
const chai = require('chai');
const Dataset = require('models/dataset.model');
const { createDataset, getUUID, deserializeDataset } = require('./utils');

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


    it('Not authorized dataset deletion should fail', async () => {
        const response = await requester
            .delete(`/api/v1/dataset/${cartoFakeDataset._id}`)
            .send();

        response.status.should.equal(401);
    });

    it('Deleting a non-existing dataset should fail', async () => {
        const uuid = getUUID();
        const response = await requester.delete(`/api/v1/dataset/${uuid}?loggedUser=${JSON.stringify(ROLES.ADMIN)}`).send();

        response.status.should.equal(404);
        response.body.should.have.property('errors').and.be.an('array');
        response.body.errors[0].should.have.property('detail').and.equal(`Dataset with id '${uuid}' doesn't exist`);
    });

    it('Deleting an existing dataset should be successful and return the dataset', async () => {
        const deleteResponse = await requester.delete(`/api/v1/dataset/${cartoFakeDataset._id}?loggedUser=${JSON.stringify(ROLES.ADMIN)}`).send();

        deleteResponse.status.should.equal(200);
        const createdDataset = deserializeDataset(deleteResponse);

        deleteResponse.status.should.equal(200);
        deleteResponse.body.should.have.property('data').and.be.an('object');
        createdDataset.should.have.property('name').and.equal(cartoFakeDataset.name);
        createdDataset.should.have.property('connectorType').and.equal('rest');
        createdDataset.should.have.property('provider').and.equal('cartodb');
        createdDataset.should.have.property('userId').and.equal(ROLES.ADMIN.id);
        createdDataset.should.have.property('status').and.equal('saved');
        createdDataset.should.have.property('overwrite').and.equal(true);
        createdDataset.legend.should.be.an.instanceOf(Object);
        createdDataset.clonedHost.should.be.an.instanceOf(Object);

        const getResponse = await requester.get(`/api/v1/dataset/${cartoFakeDataset._id}`).send();

        getResponse.status.should.equal(404);
        getResponse.body.should.have.property('errors').and.be.an('array');
        getResponse.body.errors[0].should.have.property('detail').and.equal(`Dataset with id '${cartoFakeDataset._id}' doesn't exist`);
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
