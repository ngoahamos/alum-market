const mongoose = require("mongoose");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const config = require("../config");
const User = require("../models/user.model");
const Item = require("../models/item.model").default;

const login = async (user) => {
    const response = await request(app)
        .post("/api/auth/login")
        .auth(user.username, user.password);
    expect(response.status).toBe(200);
    return response.headers["set-cookie"];
};

const newUser = async (user) =>
    new User({
        username: user.username,
        password: await bcrypt.hash(user.password, 10),
    }).save();

const user = {
    username: "test",
    password: "test",
};
var cookie;

beforeAll(async () => {
    await mongoose.connect(config.MONDODB_TEST_URI);
    const model = await newUser(user);
    user._id = `${model._id}`;
    cookie = await login(user);
});

afterAll(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
});

describe("GET /api/items", () => {
    const user1 = { username: "test1", password: "test1" };
    const user2 = { username: "test2", password: "test2" };

    const user1Item = {
        price: 1,
        tags: ["tag1", "tag2"],
        description: "test1's item description",
    };
    const user2Item = {
        price: 2,
        tags: ["tag2", "tag3"],
        description: "test2's item description",
    };

    beforeAll(async () => {
        let model;
        model = await newUser(user1);
        user1._id = `${model._id}`;

        model = await newUser(user2);
        user2._id = `${model._id}`;

        user1Item.owner = user1._id;
        model = await new Item(user1Item).save();
        user1Item._id = `${model._id}`;

        user2Item.owner = user2._id;
        model = await new Item(user2Item).save();
        user2Item._id = `${model._id}`;
    });

    afterAll(async () => {
        await User.deleteMany({ _id: { $ne: user._id } });
        await Item.deleteMany({});
    });

    it("should return 401 if not logged in", async () => {
        let response = await request(app).get(`/api/items`);
        expect(response.status).toBe(401);
    });

    it("filter by owner", async () => {
        let response = await request(app)
            .get(`/api/items?owner=${user1._id}`)
            .set("Cookie", cookie);
        expect(response.status).toBe(200);
        expect(response.body.length).toBe(1);
        expect(response.body[0]._id).toBe(user1Item._id);
    });

    it("filter by price", async () => {
        let response = await request(app)
            .get(`/api/items?price=${user1Item.price}`)
            .set("Cookie", cookie);
        expect(response.status).toBe(200);
        expect(response.body.length).toBe(1);
        expect(response.body[0]._id).toBe(user1Item._id);

        response = await request(app)
            .get(`/api/items?priceMin=${user2Item.price}`)
            .set("Cookie", cookie);
        expect(response.status).toBe(200);
        expect(response.body.length).toBe(1);
        expect(response.body[0]._id).toBe(user2Item._id);

        response = await request(app)
            .get(`/api/items?priceMax=${user1Item.price}`)
            .set("Cookie", cookie);
        expect(response.status).toBe(200);
        expect(response.body.length).toBe(1);
        expect(response.body[0]._id).toBe(user1Item._id);
    });

    it("filter by tags", async () => {
        let response = await request(app)
            .get(`/api/items?tags=${user1Item.tags[0]}`)
            .set("Cookie", cookie);
        expect(response.status).toBe(200);
        expect(response.body.length).toBe(1);
        expect(response.body[0]._id).toBe(user1Item._id);

        response = await request(app)
            .get(`/api/items?tags=${user1Item.tags[1]}`)
            .set("Cookie", cookie);
        expect(response.status).toBe(200);
        expect(response.body.length).toBe(2);

        response = await request(app)
            .get(`/api/items?tags=${user1Item.tags[0]},${user2Item.tags[1]}`)
            .set("Cookie", cookie);
        expect(response.status).toBe(200);
        expect(response.body.length).toBe(2);
    });

    it("filter by text", async () => {
        let response = await request(app)
            .get("/api/items?text=test1's")
            .set("Cookie", cookie);
        expect(response.status).toBe(200);
        expect(response.body.length).toBe(1);
        expect(response.body[0]._id).toBe(user1Item._id);

        response = await request(app)
            .get("/api/items?text=item")
            .set("Cookie", cookie);
        expect(response.status).toBe(200);
        expect(response.body.length).toBe(2);
    });

    it("custom sort", async () => {
        let response = await request(app)
            .get("/api/items?orderBy=price&order=asc")
            .set("Cookie", cookie);
        expect(response.status).toBe(200);
        expect(response.body.length).toBe(2);
        expect(response.body[0]._id).toBe(user1Item._id);
        expect(response.body[1]._id).toBe(user2Item._id);

        response = await request(app)
            .get("/api/items?orderBy=price&order=desc")
            .set("Cookie", cookie);
        expect(response.status).toBe(200);
        expect(response.body.length).toBe(2);
        expect(response.body[0]._id).toBe(user2Item._id);
        expect(response.body[1]._id).toBe(user1Item._id);
    });

    it("limit, offset and fields filtering", async () => {
        let response = await request(app)
            .get("/api/items?offset=1&limit=1&fields=description,price")
            .set("Cookie", cookie);
        expect(response.status).toBe(200);
        expect(response.body.length).toBe(1);
        expect(new Set(Object.keys(response.body[0]))).toEqual(
            new Set(["_id", "description", "price"])
        );
    });

    it("GET /api/items/:id", async () => {
        let response = await request(app)
            .get(`/api/items/${user1Item._id}`)
            .set("Cookie", cookie);
        expect(response.status).toBe(200);
        expect(response.body._id).toBe(user1Item._id);
    });
});

describe("GET /api/items/count", () => {
    afterAll(async () => {
        await Item.deleteMany({});
    });

    it("should return 401 if not logged in", async () => {
        let response = await request(app).get(`/api/items/count`);
        expect(response.status).toBe(401);
    });

    it("should return item count", async () => {
        let response = await request(app)
            .get(`/api/items/count`)
            .set("Cookie", cookie);
        expect(response.status).toBe(200);
        expect(response.body).toBe(0);

        await new Item({ owner: user._id, description: "test" }).save();
        response = await request(app)
            .get(`/api/items/count`)
            .set("Cookie", cookie);
        expect(response.status).toBe(200);
        expect(response.body).toBe(1);
    });
});

describe("GET /api/items/tags", () => {
    const item1 = { description: "test1", tags: ["tag1", "tag3"] };
    const item2 = { description: "test2", tags: ["tag2", "tag3"] };
    const item3 = { description: "test3", tags: ["tag2", "tag3"] };

    beforeAll(async () => {
        for (let item of [item1, item2, item3]) {
            item.owner = user._id;
            await new Item(item).save();
        }
    });

    afterAll(async () => {
        await Item.deleteMany({});
    });

    it("should return 401 if not logged in", async () => {
        let response = await request(app).get(`/api/items/tags`);
        expect(response.status).toBe(401);
    });

    it("should return tags with counts", async () => {
        let response = await request(app)
            .get(`/api/items/tags`)
            .set("Cookie", cookie);
        expect(response.status).toBe(200);
        expect(response.body.length).toBe(3);
        expect(response.body[0].tag).toBe("tag3");
        expect(response.body[0].count).toBe(3);
        expect(response.body[1].tag).toBe("tag2");
        expect(response.body[1].count).toBe(2);
        expect(response.body[2].tag).toBe("tag1");
    });
});
