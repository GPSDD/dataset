const URL = require('url').URL;
const logger = require('logger');
const Dataset = require('models/dataset.model');
const RelationshipsService = require('services/relationships.service');
const ctRegisterMicroservice = require('ct-register-microservice-node');
const SyncService = require('services/sync.service');
const FileDataService = require('services/fileDataService.service');
const DatasetNotFound = require('errors/datasetNotFound.error');
const DatasetProtected = require('errors/datasetProtected.error');
const ConnectorUrlNotValid = require('errors/connectorUrlNotValid.error');
const SyncError = require('errors/sync.error');
const GraphService = require('services/graph.service');
const slug = require('slug');

const stage = process.env.NODE_ENV;

class DatasetService {

    static async getSlug(name) {
        let valid = false;
        let slugTemp = null;
        let i = 0;
        while (!valid) {
            slugTemp = slug(name);
            if (i > 0) {
                slugTemp += `_${i}`;
            }
            const currentDataset = await Dataset.findOne({
                slug: slugTemp
            }).exec();
            if (!currentDataset) {
                return slugTemp;
            }
            i++;
        }
    }

    static getTableName(dataset) {
        try {
            if (dataset.provider === 'cartodb' && dataset.connectorUrl) {
                if (dataset.connectorUrl.indexOf('/tables/') >= 0) {
                    return new URL(dataset.connectorUrl).pathname.split('/tables/')[1].split('/')[0];
                }
                return decodeURI(new URL(dataset.connectorUrl)).toLowerCase().split('from ')[1].split(' ')[0];
            } else if (dataset.provider === 'featureservice' && dataset.connectorUrl) {
                return new URL(dataset.connectorUrl).pathname.split(/services|FeatureServer/)[1].replace(/\//g, '');
            } else if (dataset.provider === 'rwjson' && dataset.connectorUrl) {
                return 'data';
            }
            return dataset.tableName;
        } catch (err) {
            throw new ConnectorUrlNotValid('Invalid connectorUrl format');
        }
    }

    static getFilteredQuery(query, ids = []) {
        const collection = query.collection;
        const favourite = query.favourite;
        if (!query.env) { // default value
            query.env = 'production';
        }
        if (query.userId) {
            query.userId = {
                $eq: query.userId
            };
        }
        const datasetAttributes = Object.keys(Dataset.schema.paths);
        logger.debug('Object.keys(query)', Object.keys(query));
        Object.keys(query).forEach((param) => {
            if (datasetAttributes.indexOf(param) < 0 && param !== 'usersRole') {
                delete query[param];
            } else if (param !== 'env' && param !== 'userId' && param !== 'usersRole') {
                switch (Dataset.schema.paths[param].instance) {

                case 'String':
                    query[param] = {
                        $regex: query[param],
                        $options: 'i'
                    };
                    break;
                case 'Array':
                    if (query[param].indexOf('@') >= 0) {
                        query[param] = {
                            $all: query[param].split('@').map(elem => elem.trim())
                        };
                    } else {
                        query[param] = {
                            $in: query[param].split(',').map(elem => elem.trim())
                        };
                    }
                    break;
                case 'Mixed':
                    query[param] = { $ne: null };
                    break;
                case 'Date':
                    query[param] = query[param];
                    break;
                default:
                    query[param] = query[param];

                }
            } else if (param === 'env') {
                query.env = {
                    $in: query[param].split(',')
                };
            } else if (param === 'usersRole') {
                logger.debug('Params users roles');
                query.userId = Object.assign({}, query.userId || {}, {
                    $in: query[param]
                });
                delete query.usersRole;
            } else if (param === 'userId') {
                logger.debug('params userid', query[param]);
                query.userId = Object.assign({}, query.userId || {}, query[param]);
            }
        });
        if (ids.length > 0 || collection || favourite) {
            query._id = {
                $in: ids
            };
        }
        logger.debug(query);
        return query;
    }

    static getFilteredSort(sort) {
        const sortParams = sort.split(',');
        const filteredSort = {};
        const datasetAttributes = Object.keys(Dataset.schema.obj);
        sortParams.forEach((param) => {
            let sign = param.substr(0, 1);
            let realParam = param.substr(1);
            if (sign !== '-') {
                sign = '+';
                realParam = param;
            }
            if (datasetAttributes.indexOf(realParam) >= 0) {
                filteredSort[realParam] = parseInt(sign + 1, 10);
            }
        });
        return filteredSort;
    }

    static async get(id, query = {}) {
        logger.debug(`[DatasetService]: Getting dataset with id:  ${id}`);
        logger.info(`[DBACCESS-FIND]: dataset.id: ${id}`);
        let dataset = await Dataset.findById(id).exec() || await Dataset.findOne({
            slug: id
        }).exec();
        const includes = query.includes ? query.includes.split(',').map(elem => elem.trim()) : [];
        if (!dataset) {
            logger.error(`[DatasetService]: Dataset with id ${id} doesn't exist`);
            throw new DatasetNotFound(`Dataset with id '${id}' doesn't exist`);
        }
        if (includes.length > 0) {
            dataset = await RelationshipsService.getRelationships([dataset], includes, Object.assign({}, query));
        }
        return dataset;
    }

    static async create(dataset, user) {
        logger.debug(`[DatasetService]: Getting dataset with name:  ${dataset.name}`);
        logger.info(`[DBACCES-FIND]: dataset.name: ${dataset.name}`);
        const tempSlug = await DatasetService.getSlug(dataset.name);
        // Check if raw dataset
        if (dataset.connectorUrl && dataset.connectorUrl.indexOf('rw.dataset.raw') >= 0) {
            dataset.connectorUrl = await FileDataService.copyFile(dataset.connectorUrl);
        }
        logger.info(`[DBACCESS-SAVE]: dataset.name: ${dataset.name}`);
        let newDataset = await new Dataset({
            name: dataset.name,
            slug: tempSlug,
            type: dataset.type,
            subtitle: dataset.subtitle,
            dataPath: dataset.dataPath,
            attributesPath: dataset.attributesPath,
            connectorType: dataset.connectorType,
            provider: dataset.provider,
            userId: user.id,
            env: dataset.env || 'production',
            geoInfo: dataset.geoInfo || false,
            connectorUrl: dataset.connectorUrl,
            tableName: DatasetService.getTableName(dataset),
            overwrite: dataset.overwrite || dataset.dataOverwrite,
            status: dataset.connectorType === 'wms' ? 'saved' : 'pending',
            sandbox: dataset.sandbox,
            published: user.role === 'ADMIN' ? dataset.published : false,
            subscribable: dataset.subscribable,
            protected: dataset.protected,
            verified: dataset.verified,
            legend: dataset.legend,
            clonedHost: dataset.clonedHost
        }).save();
        logger.debug('[DatasetService]: Creating in graph');
        if (stage !== 'staging') {
            try {
                await GraphService.createDataset(newDataset._id);
            } catch (err) {
                newDataset.errorMessage = err.message;
                newDataset = await DatasetService.update(newDataset._id, newDataset, {
                    id: 'microservice'
                });
            }
        }
        // if vocabularies
        if (dataset.vocabularies) {
            if (stage !== 'staging') {
                try {
                    logger.debug('[DatasetService]: Creating relations in graph');
                    await GraphService.associateTags(newDataset._id, dataset.vocabularies);
                } catch (err) {
                    newDataset.errorMessage = err.message;
                    newDataset = await DatasetService.update(newDataset._id, newDataset, {
                        id: 'microservice'
                    });
                }
            }
            try {
                await RelationshipsService.createVocabularies(newDataset._id, dataset.vocabularies);
            } catch (err) {
                newDataset.errorMessage = err.message;
                newDataset = await DatasetService.update(newDataset._id, newDataset, {
                    id: 'microservice'
                });
            }
        }
        if (dataset.sync && dataset.connectorType === 'document') {
            try {
                await SyncService.create(Object.assign(newDataset, dataset));
            } catch (err) {
                if (err instanceof SyncError) {
                    newDataset.status = 'failed';
                    newDataset.errorMessage = 'Error synchronizing dataset';
                    logger.info(`[DBACCESS-SAVE]: dataset`);
                    newDataset = await newDataset.save();
                } else {
                    logger.error(err.message);
                }
            }
        }
        return newDataset;
    }

    static async updateEnv(datasetId, env) {
        logger.debug('Updating env of all resources of dataset', datasetId, 'with env ', env);
    }

    static async update(id, dataset, user) {
        logger.debug(`[DatasetService]: Getting dataset with id:  ${id}`);
        logger.info(`[DBACCESS-FIND]: dataset.id: ${id}`);
        const currentDataset = await Dataset.findById(id).exec() || await Dataset.findOne({
            slug: id
        }).exec();
        if (!currentDataset) {
            logger.error(`[DatasetService]: Dataset with id ${id} doesn't exist`);
            throw new DatasetNotFound(`Dataset with id '${id}' doesn't exist`);
        }
        if (dataset.connectorUrl && dataset.connectorUrl.indexOf('rw.dataset.raw') >= 0) {
            dataset.connectorUrl = await FileDataService.uploadFileToS3(dataset.connectorUrl);
        }
        let updateEnv = false;
        if (dataset.env && currentDataset.env !== dataset.env) {
            updateEnv = true;
        }
        const tableName = DatasetService.getTableName(dataset);
        currentDataset.name = dataset.name || currentDataset.name;
        currentDataset.subtitle = dataset.subtitle || currentDataset.subtitle;
        currentDataset.dataPath = dataset.dataPath || currentDataset.dataPath;
        currentDataset.attributesPath = dataset.attributesPath || currentDataset.attributesPath;
        currentDataset.connectorType = dataset.connectorType || currentDataset.connectorType;
        currentDataset.provider = dataset.provider || currentDataset.provider;
        currentDataset.connectorUrl = dataset.connectorUrl || currentDataset.connectorUrl;
        currentDataset.tableName = tableName || currentDataset.tableName;
        currentDataset.type = dataset.type || currentDataset.type;
        currentDataset.env = dataset.env || currentDataset.env;
        if (dataset.geoInfo !== undefined) {
            currentDataset.geoInfo = dataset.geoInfo;
        }
        if (dataset.overwrite === false || dataset.overwrite === true) {
            currentDataset.overwrite = dataset.overwrite;
        } else if (dataset.dataOverwrite === false || dataset.dataOverwrite === true) {
            currentDataset.overwrite = dataset.dataOverwrite;
        }
        if ((dataset.published === false || dataset.published === true) && user.role === 'ADMIN') {
            currentDataset.published = dataset.published;
        }
        if ((dataset.verified === false || dataset.verified === true)) {
            currentDataset.verified = dataset.verified;
        }
        if ((dataset.protected === false || dataset.protected === true)) {
            currentDataset.protected = dataset.protected;
        }
        if ((dataset.sandbox === false || dataset.sandbox === true)) {
            currentDataset.sandbox = dataset.sandbox;
        }
        currentDataset.subscribable = dataset.subscribable || currentDataset.subscribable;
        currentDataset.legend = dataset.legend || currentDataset.legend;
        currentDataset.clonedHost = dataset.clonedHost || currentDataset.clonedHost;
        currentDataset.updatedAt = new Date();
        if (user.id === 'microservice' && (dataset.status === 0 || dataset.status === 1 || dataset.status === 2)) {
            if (dataset.status === 0) {
                currentDataset.status = 'pending';
                currentDataset.errorMessage = '';
            } else if (dataset.status === 1) {
                currentDataset.status = 'saved';
                currentDataset.errorMessage = '';
            } else {
                currentDataset.status = 'failed';
                currentDataset.errorMessage = dataset.errorMessage;
            }
        }
        if (user.id === 'microservice' && dataset.blockchain && dataset.blockchain.id && dataset.blockchain.hash) {
            currentDataset.blockchain = dataset.blockchain;
        }
        if (user.id === 'microservice' && dataset.taskId) {
            currentDataset.taskId = dataset.taskId;
        }
        logger.info(`[DBACCESS-SAVE]: dataset`);
        let newDataset = await currentDataset.save();
        if (updateEnv) {
            logger.debug('Updating env in all resources');
            await DatasetService.updateEnv(currentDataset._id, currentDataset.env);
        }
        if (dataset.sync && newDataset.connectorType === 'document') {
            try {
                await SyncService.update(Object.assign(newDataset, dataset));
            } catch (err) {
                if (err instanceof SyncError) {
                    newDataset.status = 'failed';
                    newDataset.errorMessage = 'Error synchronizing dataset';
                    logger.info(`[DBACCESS-SAVE]: dataset`);
                    newDataset = await newDataset.save();
                } else {
                    logger.error(err.message);
                }
            }
        }
        return newDataset;
    }

    static async deleteMetadata(datasetId) {
        logger.info('Deleting metadata of dataset', datasetId);
        await ctRegisterMicroservice.requestToMicroservice({
            uri: `/dataset/${datasetId}/metadata`,
            method: 'DELETE'
        });
    }

    static async delete(id, user) {
        logger.debug(`[DatasetService]: Getting dataset with id:  ${id}`);
        logger.info(`[DBACCESS-FIND]: dataset.id: ${id}`);
        const currentDataset = await Dataset.findById(id).exec() || await Dataset.findOne({
            slug: id
        }).exec();
        if (!currentDataset) {
            logger.error(`[DatasetService]: Dataset with id ${id} doesn't exist`);
            throw new DatasetNotFound(`Dataset with id '${id}' doesn't exist`);
        }
        if (currentDataset.protected) {
            logger.error(`[DatasetService]: Dataset with id ${id} is protected`);
            throw new DatasetProtected(`Dataset is protected`);
        }
        logger.info(`[DBACCESS-DELETE]: dataset.id: ${id}`);
        if (currentDataset.connectorType === 'document') {
            try {
                await ctRegisterMicroservice.requestToMicroservice({
                    uri: `/document/${currentDataset._id}`,
                    method: 'DELETE',
                    json: true
                });
                SyncService.delete(currentDataset._id);
            } catch (err) {
                logger.error(err.message);
            }
        }
        logger.debug('[DatasetService]: Deleting in graph');
        try {
            await GraphService.deleteDataset(id);
        } catch (err) {
            logger.error('Error removing dataset of the graph', err);
        }
        logger.debug('[DatasetService]: Deleting metadata');
        try {
            await DatasetService.deleteMetadata(id);
        } catch (err) {
            logger.error('Error removing metadata', err);
        }
        // remove the dataset at the end
        const deletedDataset = await currentDataset.remove();
        return deletedDataset;
    }

    static async getAll(query = {}) {
        logger.debug(`[DatasetService]: Getting all datasets`);
        const sort = query.sort || '';
        const page = query['page[number]'] ? parseInt(query['page[number]'], 10) : 1;
        const limit = query['page[size]'] ? parseInt(query['page[size]'], 10) : 10;
        const ids = query.ids ? query.ids.split(',').map(elem => elem.trim()) : [];
        const includes = query.includes ? query.includes.split(',').map(elem => elem.trim()) : [];
        const filteredQuery = DatasetService.getFilteredQuery(Object.assign({}, query), ids);
        const filteredSort = DatasetService.getFilteredSort(sort);
        const options = {
            page,
            limit,
            sort: filteredSort
        };
        logger.info(`[DBACCESS-FIND]: dataset`);
        let pages = await Dataset.paginate(filteredQuery, options);
        pages = Object.assign({}, pages);
        if (includes.length > 0) {
            pages.docs = await RelationshipsService.getRelationships(pages.docs, includes, Object.assign({}, query));
        }
        return pages;
    }

    static async clone(id, dataset, user, fullCloning = false) {
        logger.debug(`[DatasetService]: Getting dataset with id:  ${id}`);
        logger.info(`[DBACCESS-FIND]: dataset.id: ${id}`);
        const currentDataset = await Dataset.findById(id).exec() || await Dataset.findOne({
            slug: id
        }).exec();
        if (!currentDataset) {
            logger.error(`[DatasetService]: Dataset with id ${id} doesn't exist`);
            throw new DatasetNotFound(`Dataset with id '${id}' doesn't exist`);
        }
        const newDataset = {};
        newDataset.name = `${currentDataset.name} - ${new Date().getTime()}`;
        newDataset.subtitle = currentDataset.subtitle;
        newDataset.dataPath = 'data';
        newDataset.attributesPath = currentDataset.attributesPath;
        newDataset.connectorType = 'document';
        newDataset.provider = 'json';
        newDataset.connectorUrl = dataset.datasetUrl;
        newDataset.tableName = currentDataset.tableName;
        newDataset.overwrite = currentDataset.overwrite || currentDataset.dataOverwrite;
        newDataset.published = user.role === 'ADMIN' ? dataset.published || currentDataset.published : false;
        newDataset.legend = dataset.legend;
        newDataset.clonedHost = {
            hostProvider: currentDataset.provider,
            hostUrl: dataset.datasetUrl,
            hostId: currentDataset._id,
            hostType: currentDataset.connectorType,
            hostPath: currentDataset.tableName
        };
        const createdDataset = await DatasetService.create(newDataset, user);
        logger.debug('[DatasetService]: Creating in graph');
        if (stage !== 'staging') {
            try {
                await GraphService.createDataset(newDataset._id);
            } catch (err) {
                logger.error('Error creating dataset in graph. Removing dataset');
                await createdDataset.remove();
                throw new Error(err);
            }
        }
        if (fullCloning) {
            RelationshipsService.cloneVocabularies(id, createdDataset.toObject()._id);
            RelationshipsService.cloneMetadatas(id, createdDataset.toObject()._id);
        }
        return createdDataset;
    }

    static async hasPermission(id, user) {
        let permission = true;
        const dataset = await DatasetService.get(id);
        if ((user.role === 'MANAGER') && (!dataset.userId || dataset.userId !== user.id)) {
            permission = false;
        }
        return permission;
    }

}

module.exports = DatasetService;
