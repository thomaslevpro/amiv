import { deleteAccount } from './accountDeletion.ts'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.104.1'

type MockOptions = {
  preparationError?: { code: string }
  files?: { bucket: string; name: string }[]
  storageError?: { message: string }
  queueError?: { message: string }
  pendingQueue?: { name: string }[]
}

function makeClient(options: MockOptions = {}) {
  const calls = { rpc: [] as string[], storageRemove: 0, authDelete: 0, queueDelete: 0 }
  const client = {
    rpc: async (name: string) => {
      calls.rpc.push(name)
      if (name.startsWith('prepare_')) {
        if (options.preparationError) return { data: null, error: options.preparationError }
        return {
          data: {
            transferred_event_ids: [],
            deleted_event_ids: [],
            files: options.files ?? [],
          },
          error: null,
        }
      }
      throw new Error(`unexpected rpc ${name}`)
    },
    storage: {
      from: () => ({
        remove: async () => {
          calls.storageRemove += 1
          return { error: options.storageError ?? null }
        },
      }),
    },
    from: () => {
      const query = {
        delete: () => query,
        select: () => query,
        eq: () => query,
        in: async () => {
          calls.queueDelete += 1
          return { error: options.queueError ?? null }
        },
        limit: async () => ({ data: options.pendingQueue ?? [], error: null }),
      }
      return query
    },
    auth: { admin: { deleteUser: async () => { calls.authDelete += 1; return { error: null } } } },
  } as unknown as SupabaseClient
  return { client, calls }
}

Deno.test('automatic retention deletion is blocked before any data or Auth mutation', async () => {
  const { client, calls } = makeClient({ files: [{ bucket: 'event-covers', name: 'event/file.jpg' }] })
  const results = await Promise.all([
    deleteAccount(client, 'test-user', true),
    deleteAccount(client, 'test-user', true),
  ])
  if (results.some(result => result.ok || result.step !== 'blocked')) throw new Error('automatic deletion was not blocked')
  if (calls.rpc.length || calls.storageRemove || calls.queueDelete || calls.authDelete) {
    throw new Error('blocked automatic deletion performed a side effect')
  }
})

Deno.test('manual account deletion still follows the resumable deletion workflow', async () => {
  const { client, calls } = makeClient()
  const result = await deleteAccount(client, 'test-user')
  if (!result.ok) throw new Error('manual deletion did not proceed')
  if (!calls.rpc.includes('prepare_account_deletion_with_storage_queue')) throw new Error('manual deletion was not prepared')
  if (calls.authDelete !== 1) throw new Error('manual deletion did not reach Auth deletion')
})

Deno.test('storage failure keeps Auth account and queued plan for retry', async () => {
  const { client, calls } = makeClient({
    files: [{ bucket: 'event-covers', name: 'event/file.jpg' }],
    storageError: { message: 'storage unavailable' },
  })
  const result = await deleteAccount(client, 'test-user')
  if (result.ok || result.step !== 'storage') throw new Error('storage failure was not returned')
  if (calls.authDelete !== 0) throw new Error('Auth deletion ran after storage failure')
  if (calls.queueDelete !== 0) throw new Error('failed object was removed from the durable queue')
})

Deno.test('queue persistence failure prevents Auth deletion', async () => {
  const { client, calls } = makeClient({
    files: [{ bucket: 'event-covers', name: 'event/file.jpg' }],
    queueError: { message: 'database unavailable' },
  })
  const result = await deleteAccount(client, 'test-user')
  if (result.ok || result.step !== 'storage') throw new Error('queue failure was not returned')
  if (calls.authDelete !== 0) throw new Error('Auth deletion ran while queue state was ambiguous')
})

Deno.test('remaining queued objects prevent Auth deletion', async () => {
  const { client, calls } = makeClient({ pendingQueue: [{ name: 'event/file.jpg' }] })
  const result = await deleteAccount(client, 'test-user')
  if (result.ok || result.step !== 'storage') throw new Error('non-empty storage queue was ignored')
  if (calls.authDelete !== 0) throw new Error('Auth deletion ran with queued objects')
})
