import * as trpcNext from '@trpc/server/adapters/next';
import { db } from './db';
import { _users } from './db/schema';

export async function createContext({ req, res, info }: trpcNext.CreateNextContextOptions) {
    const id = info.connectionParams?.id ? info.connectionParams.id : req.headers.id;

    if (!id) throw Error(`Id is required`);

    const user = await db
        .insert(_users)
        .values({ id })
        .onConflictDoUpdate({ target: _users.id, set: { id } })
        .returning()
        .then((result) => result.at(0));

    if (!user) throw Error(`Unknown user ${id}`);

    return { user };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
