
class DatasetSerializer {

    static serializeElement(el) {
        return {
            id: el._id,
            type: 'dataset',
            attributes: {
                name: el.name,
                slug: el.slug,
                type: el.type,
                dataPath: el.dataPath,
                attributesPath: el.attributesPath,
                connectorType: el.connectorType,
                provider: el.provider,
                userId: el.userId,
                connectorUrl: el.connectorUrl,
                tableName: el.tableName,
                status: el.status,
                published: el.published,
                sandbox: el.sandbox,
                overwrite: el.overwrite,
                verified: el.verified,
                blockchain: el.blockchain,
                subscribable: el.subscribable,
                env: el.env,
                geoInfo: el.geoInfo,
                protected: el.protected,
                legend: el.legend,
                clonedHost: el.clonedHost,
                errorMessage: el.errorMessage,
                taskId: el.taskId,
                createdAt: el.createdAt,
                updatedAt: el.updatedAt,
                metadata: el.metadata,
                vocabulary: el.vocabulary,
                user: el.user
            }
        };
    }

    static serialize(data, link = null) {
        const result = {};
        if (data && Array.isArray(data) && data.length === 0) {
            result.data = [];
            return result;
        }
        if (data) {
            if (data.docs) {
                while (data.docs.indexOf(undefined) >= 0) {
                    data.docs.splice(data.docs.indexOf(undefined), 1);
                }
                result.data = data.docs.map(el => DatasetSerializer.serializeElement(el));
            } else {
                if (Array.isArray(data)) {
                    result.data = DatasetSerializer.serializeElement(data[0]);
                } else {
                    result.data = DatasetSerializer.serializeElement(data);
                }
            }
        }
        if (link) {
            result.links = {
                self: `${link}page[number]=${data.page}&page[size]=${data.limit}`,
                first: `${link}page[number]=1&page[size]=${data.limit}`,
                last: `${link}page[number]=${data.pages}&page[size]=${data.limit}`,
                prev: `${link}page[number]=${data.page - 1 > 0 ? data.page - 1 : data.page}&page[size]=${data.limit}`,
                next: `${link}page[number]=${data.page + 1 < data.pages ? data.page + 1 : data.pages}&page[size]=${data.limit}`,
            };
            result.meta = {
                'total-pages': data.pages,
                'total-items': data.total,
                size: data.limit
            };
        }
        return result;
    }

}

module.exports = DatasetSerializer;
