import 'mocha'
import {expect} from 'chai'

import {
    Model, FieldDef,
    Relationship, ToOneRelationship, ToManyRelationship, ReverseRelationship,
    connect, release
} from '../src/'

// Models (ideal definition)
// -----------------------------------------------------------------------------
//
// class Animal {
//      name: string
//      age: int
//      created_at: timestamp
//
//      owner: Person
// }
//
// class Person {
//      first_name: string
//      last_name: string
//      age: int
//      created_at: timestamp
//
//      pets: Animal[]
//      following: Person[]
//      followers: Person[]
// }

// Models
// -----------------------------------------------------------------------------

@Model.register
class Animal extends Model {
    static _table = 'animals'

    name: string
    age?: number

    static _fields = {
        name: new FieldDef('string', {optional: false, unique: true}),
        age: new FieldDef('int')
    }

    owner?: Person
    favorite_pet_of?: Person

    static _relationships = {
        owner: new ReverseRelationship('Person', 'pets', true),
        favorite_pet_of: new ReverseRelationship('Person', 'favorite_pet')
    }
}

console.log('[Animal]', Animal)
console.log('[Animal.find]', Animal.find)

@Model.register
class Person extends Model {
    static _table = 'people'

    name: string
    age?: number

    static _fields = {
        name: new FieldDef('string', {optional: false, unique: true}),
        age: new FieldDef('int')
    }

    pets?: Animal[]
    favorite_pet?: Animal
    following?: Person[]
    followers?: Person[]

    static _relationships = {
        best_friend: new ToOneRelationship('Person', 'Person', 'best_friend'),
        pets: new ToManyRelationship('Person', 'Animal', 'pets'),
        favorite_pet: new ToOneRelationship('Person', 'Animal', 'favorite_pet'),
        following: new ToOneRelationship('Person', 'Person', 'following'),
        followers: new ReverseRelationship('Person', 'following')
    }
}

// Connect/release
// -----------------------------------------------------------------------------

before(connect.bind(null, {drop: true}))
after(release)

// Main test methods
// -----------------------------------------------------------------------------

describe("Create items", function() {

    it("Creates a few people", async function() {
        const created_p1 = await Person.create({name: 'Onedy', age: 11})
        const created_p2 = await Person.create({name: 'Twooey', age: 22})
        const created_p3 = await Person.create({name: 'Trey', age: 33})

        expect(created_p1).to.have.own.property('id')
        expect(created_p2.id).to.be.above(created_p1.id)
    })

    it("Creates a few animals", async function() {
        const created_a1 = await Animal.create({name: 'Floof', age: 1})
        const created_a2 = await Animal.create({name: 'Lolly', age: 2})
        const created_a3 = await Animal.create({name: 'Moira', age: 3})
        const created_a4 = await Animal.create({name: 'Fooey', age: 4})

        expect(created_a1).to.have.own.property('id')
        expect(created_a2.id).to.be.above(created_a1.id)
    })

})

describe("Get and find items", function() {
    it("Gets an individual item", async function() {
        const got_p1: Person | null = await Person.get(1)

        expect(got_p1).to.have.own.property('id')
        expect(got_p1?.id).to.equal(1)
        expect(got_p1?.name).to.equal('Onedy')
    })

    it("Finds all items in the collection", async function() {
        const found_ps: Person[] = await Person.find({})
        const found_ps_names = found_ps.map((p) => p.name)

        expect(found_ps).to.have.lengthOf(3)
        expect(found_ps_names).to.have.members(['Onedy', 'Twooey', 'Trey'])
    })
})

describe("Update items", function() {

    it("Updates an attribute", async function() {
        const new_name = 'Powderpuff'

        const got_a1: Animal | null = await Animal.get(1)
        const updated_a1: Animal | null = await Animal.update(1, <Animal>{name: new_name})

        expect(got_a1?.name).to.not.equal(new_name)
        expect(updated_a1?.name).to.equal(new_name)
    })

})

describe("Delete items", function() {

    it("Deletes an animal", async function() {
        const got_a4 = await Animal.get(4)
        const deleted_a4 = await Animal.delete(4)

        expect(got_a4).to.have.own.property('id')
        expect(deleted_a4).to.have.own.property('success')
        expect(deleted_a4.success).to.equal(true)
    })

    it("Deleted animal no longer exists", async function() {
        const got_a4 = await Animal.get(4)
        expect(got_a4).to.equal(null)
    })

})

describe("To-many relationships", function() {

    let p1, p2, p3
    let a1, a2, a3

    before(async function() {
        p1 = await Person.get(1)
        p2 = await Person.get(2)
        p3 = await Person.get(3)
        a1 = await Animal.get(1)
        a2 = await Animal.get(2)
        a3 = await Animal.get(3)
    })

    it("Add to-many relationships (person -> pets)", async function() {
        const p1_pets_added = await p1.add_related('pets', [a1, a2, a3])

        expect(p1_pets_added).to.have.lengthOf(3)
        expect(p1_pets_added.map(rel => rel.to_animals_id)).to.have.members([1, 2, 3])
    })

    it("Added to-many relationships can be retrieved", async function() {
        const p1_pets: Animal[] = await p1.find_related('pets')

        expect(p1_pets).to.have.lengthOf(3)
        expect(p1_pets.map(pet => pet.id)).to.have.members([1, 2, 3])
    })

    it("Added to-many relationships can be retrieved in reverse", async function() {
        const a1_owner: Person = await a1.get_related('owner')
        const a2_owner: Person = await a2.get_related('owner')
        const a3_owner: Person = await a3.get_related('owner')

        expect(a1_owner.id).to.equal(1)
        expect(a1_owner).to.deep.equal(a2_owner)
        expect(a1_owner).to.deep.equal(a3_owner)
    })

    it("Changes a to-many relationship in reverse", async function() {
        await a3.set_related('owner', p2)
        const a3_owner: Person = await a3.get_related('owner')
        expect(a3_owner.id).to.equal(2)
    })

    it("Original to-many relationship reflects changes", async function() {
        const p1_pets: Animal[] = await p1.find_related('pets')

        expect(p1_pets).to.have.lengthOf(2)
        expect(p1_pets.map(pet => pet.id)).to.have.members([1, 2])
    })

    // Remove p1 -> favorite_pet

    it("Remove a forward to-many relationship", async function() {
        const p1_pets_before: Animal[] = await p1.find_related('pets')
        await p1.remove_related('pets', [a2])
        const p1_pets_after: Animal[] = await p1.find_related('pets')

        expect(p1_pets_before).to.have.deep.members([a1, a2])
        expect(p1_pets_after).to.have.deep.members([a1])
    })
})

describe("To-one relationships", function() {

    let p1, p2, p3
    let a1, a2, a3

    before(async function() {
        p1 = await Person.get(1)
        p2 = await Person.get(2)
        a1 = await Animal.get(1)
        a2 = await Animal.get(2)
    })

    // Set p1 -> favorite_pet -> a1

    it("Creates a forward to-one relationship", async function() {
        await p1.set_related('favorite_pet', a1)
    })

    it("Retreives a forward to-one relationship", async function() {
        const p1_favorite_pet: Animal = await p1.get_related('favorite_pet')

        expect(p1_favorite_pet).to.deep.equal(a1)
    })

    it("Retreives a reverse to-one relationship", async function() {
        const a1_favorite_pet_of: Person[] = await a1.find_related('favorite_pet_of')

        expect(a1_favorite_pet_of).to.have.deep.members([p1])
    })

    // Set p1 -> favorite_pet -> a2

    it("Updates a forward to-one relationship", async function() {
        await p1.set_related('favorite_pet', a2)
        const p1_favorite_pet: Animal = await p1.get_related('favorite_pet')
        const a2_favorite_pet_of: Person[] = await a2.find_related('favorite_pet_of')
        const a1_favorite_pet_of: Person[] = await a1.find_related('favorite_pet_of')

        expect(p1_favorite_pet).to.deep.equal(a2)
        expect(a2_favorite_pet_of).to.have.deep.members([p1])
        expect(a1_favorite_pet_of).to.have.lengthOf(0)
    })

    // Set a2 <- favorite_pet_of <- p2

    it("Adds to a reverse to-one relationship", async function() {
        await a2.add_related('favorite_pet_of', [p2])
        const p2_favorite_pet: Animal = await p2.get_related('favorite_pet')
        const a2_favorite_pet_of: Person[] = await a2.find_related('favorite_pet_of')

        expect(p2_favorite_pet).to.deep.equal(a2)
        expect(a2_favorite_pet_of).to.have.deep.members([p1, p2])
    })

    // Unset p1 -> favorite_pet -> a2

    it("Unsets a forward to-one relationship", async function() {
        const p1_favorite_pet_before: Animal = await p1.get_related('favorite_pet')
        await p1.unset_related('favorite_pet', a2)
        const p1_favorite_pet_after: Animal = await p1.get_related('favorite_pet')

        expect(p1_favorite_pet_before).to.deep.equal(a2)
        expect(p1_favorite_pet_after).to.equal(null)
    })

    // Unset a2 <- favorite_pet_of <- p2

    it("Unsets a reverse to-one relationship", async function() {
        const a2_favorite_pet_of_before: Person[] = await a2.find_related('favorite_pet_of')
        await a2.remove_related('favorite_pet_of', [p2])
        const a2_favorite_pet_of_after: Person[] = await a2.find_related('favorite_pet_of')

        expect(a2_favorite_pet_of_before).to.have.deep.members([p2])
        expect(a2_favorite_pet_of_after).to.have.lengthOf(0)
    })

})

