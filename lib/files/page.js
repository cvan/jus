'use strict'

const fs              = require('fs')
const path            = require('upath')

const File            = require('../file')
const cheerio         = require('cheerio')
const frontmatter     = require('html-frontmatter')
const handlebars      = require('handlebars')
const hrefType        = require('href-type')
const lobars          = require('lobars')
const marky           = require('marky-markdown')
const nunjucks        = require('nunjucks')
const startsWith      = require('lodash').startsWith
const titlecase       = require('inflection').titleize

const templatingEngines = [
  'handlebars',
  'html',
  'nunjucks'
]

handlebars.registerHelper(lobars)

var isValidTemplatingEngine = function (engine) {
  return templatingEngines.indexOf(engine) > -1
}

var matchesExtension = function (path, extList) {
  var ext = path.split('.').slice(-2)
  // Check for `layout.hbs` or `layout.njk.html`, for example
  return extList.indexOf(ext[0]) > -1 ||
         extList.indexOf(ext[1]) > -1
}

module.exports = class Page extends File {
  constructor(filepath, sourceDir, targetDir) {
    super(filepath, sourceDir, targetDir)
  }

  squeeze() {
    this.squeezed = false
    this.read()
    this.getFrontmatter()
    this.getDOMObject()
    this.setBasedir()
    this.setTitle()
    this.squeezed = true
  }

  setHref() {
    var tail = this.isIndex ? this.path.dir : path.join(this.path.dir, this.path.name)
    this.href = path.join(process.env.JUS_BASEDIR, tail)
  }

  getFrontmatter() {
    Object.assign(this, frontmatter(this.input))
  }

  getDOMObject() {
    if (this.isMarkdown) {
      this.$ = marky(this.input, {
        sanitize: false,            // Allow script tags and stuff
        linkify: true,              // Turn orphan URLs into hyperlinks
        highlightSyntax: true,      // Run highlights on fenced code blocks
        prefixHeadingIds: false,    // Prevent DOM `id` collisions
      })
    } else {
     this.$ = cheerio.load(this.input)
    }
  }

  setBasedir() {
    var self = this
    var $ = this.$

    // Set root path on `src` attributes in the DOM
    $('[src]').each(function() {
      var src = $(this).attr('src')
      if (hrefType(src) !== 'relative') return
      if (startsWith(src, '/' + process.env.JUS_BASEDIR)) return
      // $(this).attr('src', path.join(process.env.JUS_BASEDIR, src).replace(/^\//, ''))
    })

    // Set root path on `href` attributes in the DOM
    $('[href]').each(function() {
      var href = $(this).attr('href')
      if (hrefType(href) !== 'relative') return
      if (startsWith(href, '/' + process.env.JUS_BASEDIR)) return
      // $(this).attr('href', path.join(process.env.JUS_BASEDIR, href).replace(/^\//, ''))
    })
  }

  // Precedence: HTML frontmatter, <title> tag, filename
  setTitle() {
    this.title = this.title
      || this.$('title').text()
      || titlecase(this.path.name)
  }

  render(context, done) {
    var $ = this.$
    var ctx = Object.assign({page: this}, context)
    var layouts = context.layouts
    var layout
    var output
    var templateEngine

    if (this.layout) {
      // Use layout specified in frontmatter
      layout = layouts[this.layout]
    } else if (layouts.default && this.layout !== false) {
      // Use default layout if it exists, (unless set to `false` in frontmatter)
      layout = layouts.default
    }
    if (layout && layout.input) {
      Object.assign(layout, frontmatter(layout.input))
    }
    this.currentLayout = layout

    // Convert DOM to HTML so the template can be rendered
    output = $.html()

    templateEngine = this.getTemplateEngine(output)

    if (layout && templateEngine === 'handlebars') {
      ctx.body = output
      // Render page with Handlebars
      output = handlebars.compile(layout.input)(ctx)
    } else if (layout && templateEngine === 'nunjucks') {
      // Render page with Nunjucks
      ctx.body = output
      output = nunjucks.renderString(layout.input, ctx)
    } else {
      // Render page as raw HTML
      output = output.replace(/{{{?\s*body\s*}?}}/, output)
    }

    // Back to DOM again
    $ = cheerio.load(output)

    // Add title tag to head, if missing
    if (!$('title').length && $('head').length) {
      $('head').prepend(`<title>${this.title}</title>`)
    }

    return done(null, $.html())
  }

  get isMarkdown() {
    var ext = this.path.ext.toLowerCase()
    return ext === '.md' || ext === '.markdown' || ext === '.mdown'
  }

  getTemplateEngine(output) {
    var layout = this.currentLayout
    if (!layout) {
      return 'html'
    }
    var layoutPathBase = layout.path.base

    // Check the front-matter for one of the valid engine types
    if (isValidTemplatingEngine(layout.engine)) {
      return layout.engine
    }

    // Otherwise, infer the engine type from the file extension of the layout
    if (matchesExtension(layoutPathBase, ['handlebars', 'hbs'])) {
      return 'handlebars'
    }
    if (matchesExtension(layoutPathBase, ['njk', 'nunjucks', 'nunjs', 'nunj', 'njs', 'njx', 'j2'])) {
      return 'nunjucks'
    }
    if (layout.input.indexOf('{{{') > -1) {
      return 'handlebars'
    }
    if (layout.input.indexOf('{{') > -1 ||
        layout.input.indexOf('{%') > -1) {
      return 'nunjucks'
    }
    return 'html'
  }

  get isIndex() {
    return this.path.name === 'index'
  }

}
