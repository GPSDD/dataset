const { createDataset, deserializeDataset } = require('./utils');
const nock = require('nock');
const chai = require('chai');
const Dataset = require('models/dataset.model');

const should = chai.should();

const { getTestServer } = require('./test-server');

const requester = getTestServer();

let cartoFakeDataset;
let genericFakeDataset;
let jsonFakeDataset;


describe('Dataset get tests', () => {

    before(async () => {
        if (process.env.NODE_ENV !== 'test') {
            throw Error(`Running the test suite with NODE_ENV ${process.env.NODE_ENV} may result in permanent data loss. Please use NODE_ENV=test.`);
        }

        nock.cleanAll();

        Dataset.remove({}).exec();

        cartoFakeDataset = await new Dataset(createDataset('cartodb')).save();
        genericFakeDataset = await new Dataset(createDataset('genericindex')).save();
        jsonFakeDataset = await new Dataset(createDataset('json')).save();
    });

    /* Get All Datasets */
    it('Get datasets', async () => {
        const response = await requester.get(`/api/v1/dataset`).send();

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('array');
        response.body.should.have.property('links').and.be.an('object');
    });

    /* Get a specific dataset */
    it('Get one dataset', async () => {
        const response = await requester.get(`/api/v1/dataset/${cartoFakeDataset._id}`).send();
        const dataset = deserializeDataset(response);

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('object');
        dataset.should.have.property('name').and.equal(cartoFakeDataset.name);
    });

    /* Pagination */
    it('Get 3 datasets', async () => {
        const response = await requester.get(`/api/v1/dataset?page[number]=1&page[size]=3`).send();
        const datasets = deserializeDataset(response);

        response.status.should.equal(200);
        response.body.should.have.property('data').with.lengthOf(3);
        response.body.should.have.property('links').and.be.an('object');

        const datasetIds = datasets.map(dataset => dataset.id);

        datasetIds.includes(cartoFakeDataset._id);
        datasetIds.includes(jsonFakeDataset._id);
        datasetIds.includes(genericFakeDataset._id);
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
