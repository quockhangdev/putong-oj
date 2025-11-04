import path from 'node:path'
import { env } from 'node:process'
import Koa from 'koa'
import { koaBody } from 'koa-body'
import koaLogger from 'koa-logger'
import send from 'koa-send'
import session from 'koa-session'
import staticServe from 'koa-static'
import config from './config'
import { databaseSetup } from './config/setup'
import { parseClientIp } from './middlewares'
import authnMiddleware from './middlewares/authn'
import router from './routes'
import logger from './utils/logger'
import './config/db'

const app = new Koa()

// 日志，会在控制台显示请求的方法和路由
if (env.NODE_ENV === 'development') {
  app.use(koaLogger())
}

app.keys = [ config.secretKey ]

app.use(parseClientIp)

app.use(session({
  key: 'ptoj.session',
  maxAge: config.sessionMaxAge * 1000,
  signed: true,
  renew: true,
}, app))

app.use(koaBody({
  jsonLimit: '50mb', // increase JSON payload size
  formLimit: '50mb', // increase form payload size
  textLimit: '50mb', // increase text payload size
  multipart: true, // support file uploads
  formidable: {
    maxFileSize: 100 * 1024 * 1024, // allow up to 100 MB files (e.g., large zip)
  },
}))

app.use(staticServe(path.join(__dirname, '..', 'public'), {
  gzip: true,
  maxage: 7 * 24 * 60 * 60, // 7 天不更新，也就是缓存期限
}))

app.use(async (ctx, next) => {
  ctx.state.requestId = ctx.get('X-Request-ID') || 'unknown'
  await authnMiddleware.checkSession(ctx)
  await next()
})

app.use(async (ctx, next) => {
  try {
    await next()
  } catch (err: any) {
    const { requestId } = ctx.state
    ctx.status = err.status || 500
    ctx.body = { error: err.message }
    if (err.status) {
      logger.error(`HTTP/${err.status}: ${err.message} [${requestId}]`)
    } else {
      logger.error(`${err.message} [${requestId}]\n${err.stack}]`)
    }
  }
})

app.use(async (ctx, next) => {
  await next()
  if (ctx.status === 404) {
    return send(ctx, 'public/index.html')
  }
})

app.use(router.routes()).use(router.allowedMethods())

// do not start on 'test'
if (env.NODE_ENV !== 'test') {
  app.listen(config.port, async () => {
    await databaseSetup()
    logger.info(`The server is running at http://localhost:${config.port}`)
  })
}

export default app
