import { Prisma, PrismaClient } from "@prisma/client"

export const prisma = new PrismaClient()
    .$extends({
        name: "soft-delete",
        model: {
            $allModels: {
                async delete<M>(
                    this: M,
                    params: {
                        where: Prisma.Args<M, "deleteMany">["where"]
                        include?: Prisma.Args<M, "updateMany">["include"]
                    }): Promise<any> {
                    const context = Prisma.getExtensionContext(this)
                    const { where, include } = params

                    return (context as any).update({
                        where,
                        data: {
                            deletedDate: new Date(),
                        },
                        include,
                    })
                },
                async deleteMany<M>(
                    this: M,
                    params?: {
                        where: Prisma.Args<M, "deleteMany">["where"]
                        include?: Prisma.Args<M, "updateMany">["include"]
                    }): Promise<any> {
                    const context = Prisma.getExtensionContext(this)
                    const { where, include } = params || {}

                    return (context as any).updateMany({
                        where,
                        data: {
                            deletedDate: new Date(),
                        },
                        include,
                    })
                },
            },
        },
        query: {
            $allModels: {
                async findMany({ args, query }) {
                    if (!args.where) {
                        args.where = {}
                    }

                    args.where.deletedDate = null

                    return query(args)
                },
                async findFirst({ args, query }) {
                    if (!args.where) {
                        args.where = {}
                    }

                    args.where.deletedDate = null

                    return query(args)
                },
                async findFirstOrThrow({ args, query }) {
                    if (!args.where) {
                        args.where = {}
                    }

                    args.where.deletedDate = null

                    return query(args)
                },
                async findUnique({ args, query }) {
                    args.where.deletedDate = null

                    return query(args)
                },
                async findUniqueOrThrow({ args, query }) {
                    args.where.deletedDate = null

                    return query(args)
                },
            },
        }
    })
