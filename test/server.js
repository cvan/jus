/* globals before, after, describe, it */

const assert    = require('assert')
const path      = require('path')
const supertest = require('supertest')
const server    = require('../lib/server')

describe('server', function () {
  this.timeout(5000)

  before(function(done){
    server.start(path.resolve(__dirname, 'fixtures'), done)
  })

  describe('GET /api', function(){
    var files

    before(done => {
      supertest(server)
        .get('/api')
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          files = res.body
          files.forEach(file => files[file.href] = file)
          return done()
        })
    })

    it('responds with a JSON array of file objects', function(){
      assert(Array.isArray(files))
      assert(files.length)
      assert(files['/apples'])
      assert(files['/styles.css'])
    })

  })


  describe('GET /api/files/apples', function(){
    var page

    before(done => {
      supertest(server)
        .get('/api/files/apples')
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          page = res.body
          return done()
        })
    })

    it('responds with a specific file object', function(){
      assert.equal(page.href, '/apples')
      assert.equal(page.title, 'Apples!')
    })

  })

  // describe('GET /files', function(){
  //   it('responds with json', function(done){
  //     supertest(server)
  //       .get('/files')
  //       .set('Accept', 'application/json')
  //       .expect('Content-Type', /json/)
  //       .expect(200, done)
  //   })
  // })


})
