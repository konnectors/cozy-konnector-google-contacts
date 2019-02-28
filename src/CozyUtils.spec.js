const CozyClient = require('cozy-client').default
const CozyUtils = require('./CozyUtils')

const {
  APP_NAME,
  DOCTYPE_CONTACTS,
  DOCTYPE_CONTACTS_ACCOUNT
} = require('./constants')

jest.mock('cozy-client')

describe('CozyUtils', () => {
  const cozyUtils = new CozyUtils('fakeAccountId')

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should initialize a cozy client', () => {
    expect(CozyClient).toHaveBeenCalledWith({
      schema: {
        contacts: {
          cozyMetadata: {
            createdAt: { trigger: 'creation', useCurrentDate: true },
            createdByApp: { trigger: 'creation', value: 'konnector-google' },
            createdByAppVersion: { trigger: 'update', value: '2.0.0' },
            doctypeVersion: { trigger: 'update', value: 2 },
            sourceAccount: { trigger: 'creation', value: 'fakeAccountId' },
            updatedAt: { trigger: 'update', useCurrentDate: true },
            updatedByApps: { trigger: 'update', value: ['konnector-google'] }
          },
          doctype: 'io.cozy.contacts'
        },
        contactsAccounts: { doctype: 'io.cozy.contacts.accounts' }
      },
      token: '{"token":{"accessToken":"0230b4b0-f833-4e4a-b70a-ffb1e48e2c01"}}',
      uri: 'https://rosellalabadie.mycozy.cloud'
    })

    expect(cozyUtils.client).toBeDefined()
  })

  describe('prepareIndex method', () => {
    it('should prepare an index on google id for contacts', () => {
      const createIndexSpy = jest.fn()
      cozyUtils.client.collection = jest.fn(() => ({
        createIndex: createIndexSpy
      }))
      cozyUtils.prepareIndex('fakeAccountId')
      expect(cozyUtils.client.collection).toHaveBeenCalledWith(DOCTYPE_CONTACTS)
      expect(createIndexSpy).toHaveBeenCalledWith([
        'cozyMetadata.sync.fakeAccountId.id'
      ])
    })
  })

  describe('getUpdatedContacts', () => {
    it('should get all updated contacts', async () => {
      const findSpy = jest.fn()
      // first page
      findSpy.mockResolvedValueOnce({
        data: [
          {
            id: 'john-doe'
          },
          {
            id: 'jane-doe'
          }
        ],
        next: true
      })
      // second page
      findSpy.mockResolvedValueOnce({
        data: [
          {
            id: 'pierre-durand'
          },
          {
            id: 'isabelle-durand'
          }
        ],
        next: false
      })
      cozyUtils.client.collection = jest.fn(() => ({
        find: findSpy
      }))
      const result = await cozyUtils.getUpdatedContacts(
        '2018-04-03T15:16:02.276Z'
      )
      expect(result).toEqual([
        {
          id: 'john-doe'
        },
        {
          id: 'jane-doe'
        },
        {
          id: 'pierre-durand'
        },
        {
          id: 'isabelle-durand'
        }
      ])
      expect(findSpy).toHaveBeenCalledWith(
        {
          cozyMetadata: {
            updatedAt: {
              $gt: '2018-04-03T15:16:02.276Z'
            }
          }
        },
        { indexedFields: ['cozyMetadata.updatedAt'] }
      )
    })
  })

  describe('findContact', () => {
    it('should find the contact that has given resource name', async () => {
      const findSpy = jest.fn().mockResolvedValue({
        data: [
          {
            id: 'my-awesome-contact'
          }
        ]
      })
      cozyUtils.client.collection = jest.fn(() => ({
        find: findSpy
      }))
      const result = await cozyUtils.findContact(
        'fakeAccountId',
        'people/99765'
      )
      expect(findSpy).toHaveBeenCalledWith(
        {
          cozyMetadata: {
            sync: {
              fakeAccountId: {
                id: 'people/99765'
              }
            }
          }
        },
        { indexedFields: ['cozyMetadata.sync.fakeAccountId.id'] }
      )
      expect(result).toEqual({ id: 'my-awesome-contact' })
    })
  })

  describe('findOrCreateContactAccount', () => {
    it('should return the contact account if it exists', async () => {
      const fakeAccount = {
        canLinkContacts: true,
        shouldSyncOrphan: true,
        lastSync: null,
        lastLocalSync: null,
        name: 'john.doe@gmail.com',
        _type: DOCTYPE_CONTACTS_ACCOUNT,
        type: APP_NAME,
        sourceAccount: 'fakeAccountId',
        version: 1
      }
      const findSpy = jest.fn().mockResolvedValue({
        data: [fakeAccount]
      })
      cozyUtils.client.collection = jest.fn(() => ({
        find: findSpy
      }))

      const result = await cozyUtils.findOrCreateContactAccount(
        'fakeAccountId',
        'john.doe@gmail.com'
      )
      expect(result).toEqual(fakeAccount)
    })

    it('should create a contact account if none is found', async () => {
      const findSpy = jest.fn().mockResolvedValue({
        data: []
      })
      cozyUtils.client.collection = jest.fn(() => ({
        find: findSpy
      }))
      cozyUtils.client.save = jest.fn().mockResolvedValue({
        data: {
          id: 'saved-contact-account'
        }
      })

      const result = await cozyUtils.findOrCreateContactAccount(
        'fakeAccountId',
        'john.doe@gmail.com'
      )
      expect(cozyUtils.client.save).toHaveBeenCalledWith({
        canLinkContacts: true,
        shouldSyncOrphan: true,
        lastSync: null,
        lastLocalSync: null,
        name: 'john.doe@gmail.com',
        _type: DOCTYPE_CONTACTS_ACCOUNT,
        type: APP_NAME,
        sourceAccount: 'fakeAccountId',
        version: 1
      })
      expect(result).toEqual({
        id: 'saved-contact-account'
      })
    })
  })
})
