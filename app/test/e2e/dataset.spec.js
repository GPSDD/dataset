const ROLES = require('./test.constants').ROLES;
const nock = require('nock');
const chai = require('chai');

const should = chai.should();

const { getTestServer } = require('./test-server');

const requester = getTestServer();

let referencedDataset = null;

function isArray(element) {
    if (element instanceof Array) {
        return true;
    }
    return false;
}

function isObject(property) {
    if (property instanceof Object && property.length === undefined) {
        return true;
    }
    return false;
}

function deserializeDataset(response) {
    if (isArray(response.body.data)) {
        return response.body.data.map(el => el.attributes);
    } else if (isObject(response.body.data)) {
        return response.body.data.attributes;
    }
    return response;
}

describe('E2E test', () => {

    before(() => {
        nock.cleanAll();
    });

    it('Create a Generic Index Dataset', async () => {
        nock(`${process.env.CT_URL}`)
            .post(/v1\/graph\/dataset\/(\w|-)*$/)
            .once()
            .reply(200, {
                status: 200,
                detail: 'Ok'
            });

        const timestamp = new Date().getTime();
        const dataset = {
            name: `Generic Index Dataset - ${timestamp}`,
            connectorType: 'rest',
            provider: 'genericindex'
        };
        const response = await requester
            .post(`/api/v1/dataset`)
            .send({
                dataset,
                loggedUser: ROLES.ADMIN
            });
        const createdDataset = deserializeDataset(response);
        referencedDataset = response.body.data;

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('object');
        createdDataset.should.have.property('name').and.equal(`Generic Index Dataset - ${timestamp}`);
        createdDataset.should.have.property('connectorType').and.equal('rest');
        createdDataset.should.have.property('provider').and.equal('genericindex');
        createdDataset.should.have.property('userId').and.equal(ROLES.ADMIN.id);
        createdDataset.should.have.property('status').and.equal('saved');
        createdDataset.should.have.property('overwrite').and.equal(false);
        createdDataset.legend.should.be.an.instanceOf(Object);
        createdDataset.clonedHost.should.be.an.instanceOf(Object);
    });

    /* Create a Carto Dataset */
    it('Create a CARTO DB dataset', async () => {
        nock(`${process.env.CT_URL}/v1`)
            .post('/rest-datasets/cartodb', () => true)
            .once()
            .reply(200, {
                status: 200,
                detail: 'Ok'
            });

        const timestamp = new Date().getTime();
        const dataset = {
            name: `Carto DB Dataset - ${timestamp}`,
            application: ['rw'],
            connectorType: 'rest',
            provider: 'cartodb',
            env: 'production',
            connectorUrl: 'https://wri-01.carto.com/tables/wdpa_protected_areas/table',
            overwrite: true
        };
        const response = await requester
            .post(`/api/v1/dataset`)
            .send({
                dataset,
                loggedUser: ROLES.ADMIN
            });
        const createdDataset = deserializeDataset(response);
        referencedDataset = response.body.data;

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('object');
        createdDataset.should.have.property('name').and.equal(`Carto DB Dataset - ${timestamp}`);
        // createdDataset.application.should.be.an.instanceOf(Array).and.have.lengthOf(1);
        createdDataset.should.have.property('connectorType').and.equal('rest');
        createdDataset.should.have.property('provider').and.equal('cartodb');
        createdDataset.should.have.property('connectorUrl').and.equal('https://wri-01.carto.com/tables/wdpa_protected_areas/table');
        createdDataset.should.have.property('tableName').and.equal('wdpa_protected_areas');
        createdDataset.should.have.property('userId').and.equal(ROLES.ADMIN.id);
        createdDataset.should.have.property('status').and.equal('pending');
        createdDataset.should.have.property('overwrite').and.equal(true);
        createdDataset.legend.should.be.an.instanceOf(Object);
        createdDataset.clonedHost.should.be.an.instanceOf(Object);
    });

    /* Create a FeatureServer dataset */
    it('Create a FeatureServer dataset', async () => {
        nock(`${process.env.CT_URL}/v1`)
            .post('/rest-datasets/featureservice', () => true)
            .once()
            .reply(200, {
                status: 200,
                detail: 'Ok'
            });

        const timestamp = new Date().getTime();
        const dataset = {
            name: `FeatureServer Dataset - ${timestamp}`,
            application: ['gfw', 'rw'],
            connectorType: 'rest',
            provider: 'featureservice',
            env: 'production',
            connectorUrl: 'http://services6.arcgis.com/bIipaUHHcz1GaAsv/arcgis/rest/services/Mineral_Development_Agreements/FeatureServer/0?f=pjson',
            overwrite: true
        };

        const response = await requester.post(`/api/v1/dataset`).send({
            dataset,
            loggedUser: ROLES.ADMIN
        });
        const createdDataset = deserializeDataset(response);

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('object');
        createdDataset.should.have.property('name').and.equal(`FeatureServer Dataset - ${timestamp}`);
        // createdDataset.application.should.be.an.instanceOf(Array).and.have.lengthOf(2);
        createdDataset.should.have.property('connectorType').and.equal('rest');
        createdDataset.should.have.property('provider').and.equal('featureservice');
        createdDataset.should.have.property('connectorUrl').and.equal('http://services6.arcgis.com/bIipaUHHcz1GaAsv/arcgis/rest/services/Mineral_Development_Agreements/FeatureServer/0?f=pjson');
        createdDataset.should.have.property('tableName').and.equal('Mineral_Development_Agreements');
        createdDataset.should.have.property('userId').and.equal(ROLES.ADMIN.id);
        createdDataset.should.have.property('status').and.equal('pending');
        createdDataset.should.have.property('overwrite').and.equal(true);
        createdDataset.legend.should.be.an.instanceOf(Object);
        createdDataset.clonedHost.should.be.an.instanceOf(Object);
    });

    /* Create a JSON */
    it('Create a JSON dataset', async () => {
        nock(`${process.env.CT_URL}/v1`)
            .post('/doc-datasets/json', () => true)
            .reply(200, {
                status: 200,
                detail: 'Ok'
            });

        const timestamp = new Date().getTime();
        const dataset = {
            name: `JSON Dataset - ${timestamp}`,
            application: ['forest-atlas', 'rw'],
            connectorType: 'document',
            env: 'production',
            provider: 'json',
            dataPath: 'data',
            data: {
                data: [
                    {
                        a: 1,
                        b: 2
                    },
                    {
                        a: 2,
                        b: 1
                    },
                ]
            }
        };

        const response = await requester.post(`/api/v1/dataset`).send({
            dataset,
            loggedUser: ROLES.ADMIN
        });
        const createdDataset = deserializeDataset(response);

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('object');
        createdDataset.should.have.property('name').and.equal(`JSON Dataset - ${timestamp}`);
        // createdDataset.application.should.be.an.instanceOf(Array).and.have.lengthOf(2);
        createdDataset.should.have.property('connectorType').and.equal('document');
        createdDataset.should.have.property('provider').and.equal('json');
        createdDataset.should.have.property('connectorUrl');
        createdDataset.should.have.property('tableName');
        createdDataset.should.have.property('userId').and.equal(ROLES.ADMIN.id);
        createdDataset.should.have.property('status').and.equal('pending');
        createdDataset.should.have.property('overwrite').and.equal(false);
        createdDataset.legend.should.be.an.instanceOf(Object);
        createdDataset.clonedHost.should.be.an.instanceOf(Object);
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
        const response = await requester.get(`/api/v1/dataset/${referencedDataset.id}`).send();
        const dataset = deserializeDataset(response);

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('object');
        dataset.should.have.property('name').and.equal(referencedDataset.attributes.name);
    });

    /* Pagination */
    it('Get 3 datasets', async () => {
        const response = await requester.get(`/api/v1/dataset?page[number]=1&page[size]=3`).send();

        response.status.should.equal(200);
        response.body.should.have.property('data').with.lengthOf(3);
        response.body.should.have.property('links').and.be.an('object');
    });

    /* Update */
    it('Update a dataset', async () => {
        const response = await requester
            .patch(`/api/v1/dataset/${referencedDataset.id}`)
            .send({
                name: 'other name',
                application: ['gfw', 'rw'],
                loggedUser: ROLES.ADMIN
            });
        const dataset = deserializeDataset(response);

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('object');
        dataset.should.have.property('name').and.equal('other name');
        // dataset.application.should.be.an.instanceOf(Array).and.have.lengthOf(2);
        dataset.should.have.property('connectorType').and.equal('rest');
        dataset.should.have.property('provider').and.equal('cartodb');
        dataset.should.have.property('connectorUrl').and.equal('https://wri-01.carto.com/tables/wdpa_protected_areas/table');
        dataset.should.have.property('tableName').and.equal('wdpa_protected_areas');
        dataset.should.have.property('userId').and.equal(ROLES.ADMIN.id);
        dataset.should.have.property('status').and.equal('pending');
        dataset.should.have.property('overwrite').and.equal(true);
        dataset.legend.should.be.an.instanceOf(Object);
        dataset.clonedHost.should.be.an.instanceOf(Object);
    });

    /* Delete */
    it('Not authorized dataset deletion', async () => {
        const response = await requester
            .delete(`/api/v1/dataset/${referencedDataset.id}?loggedUser=null`)
            .send();

        response.status.should.equal(401);
    });

    afterEach(() => {
        if (!nock.isDone()) {
            throw new Error(`Not all nock interceptors were used: ${nock.pendingMocks()}`);
        }
    });
});
