// Placeholder data matching the Stitch design mocks. Replace with real
// backend data once the messaging API is wired up.

const AVATAR_BASE = 'https://lh3.googleusercontent.com/aida-public';

export const AVATARS = {
  me: `${AVATAR_BASE}/AB6AXuB8DPsUn0OYfO4XVlNOpTc19z_eeyNa4T3QCOgeOToG9B4FmF0cU9xq6yIjr28bZj485UmxuTrXA_lioJgH_wWcfEu698RLxvRQgxvzAHe1twTFtsik4TouuH51ONM0Mu7djN-a3IY4oejsLZY98dwziQDzb8BQxW0_6KGnRQ9nAeZRZbzmkfChub6wZJj9Jf51WZsRXJvKwFpsbim0YuW-WSwtl8XR-9G7jjUoGD-0yaGBmpbO66K5GDB9uP14kvBl1LqA6VQtvv4`,
  alex: `${AVATAR_BASE}/AB6AXuCcZ8ruBuKXoJ3R5234SWb2Rq9ojQh7uKXFQPO1UKNEvsT6hSR0CtQTYBmqSL4QcSulEHXGoPOTPiw9zriG6ezvqhUio_4KjEa7ENH7rvhW4Zi7tCOOp7rS2VPaoaVnX42ueKCf9GS8xuREQ8oWsGVbyjQvVlapDCer2XdCkywfRQIIl_90ytgSSfk31OQsl9BQ3HXUUBpPYpTSET6MK6VxJXbm565JmBzctNesZCCItr27B2tBLyv3ZA6daOhOmmAgJ6TEoaCtDDM`,
  jordan: `${AVATAR_BASE}/AB6AXuBMkICaM6r48uofx0J1Epo2lceko2b8F1oZfMsAt6jXAu435SnBaw-NoQzifiFrKMxbeT8n1_gx9CRmF80jGMrNQuiVEZpT-3ucylgCoecO-O7DhYXbLw17TenpyBe9YWOxEaePFE-jBmgBBNbtOBt5lC_Vsaka43hNOVWPNDWKMtQK5CRi8TeR0POvLVk_tn-xdba6kDfI3AKIp9uVsT-I9PKy4ondyDTXvqtM_mcBtwmKjo2nNbSpAj5PowzhEb-Omy3qZ6-MA_c`,
  nova: `${AVATAR_BASE}/AB6AXuC5eGCuBtPHhPQLnKcP8w1ehpc3Jt3fx53vFb2FlROzpBme4lDY-y65Qkcm-ZTyakVSRnxIlZbDLy4UK88uPU8Vfd3ypP1r0WVbZt6t5d50YWtbom63jATjYAp_roBDBGvsB24p4-2H6lAYyWOU0Ss7gVuDTg5Qhcmb2424NwNpJPJUwKvpF6uuo4zCdkQKTEP_m8CKMgeiyz80sLiqVAUROD2RAmU_F9vUcB34YB1P-WHtuna8PDoT9gLvZe_gytU-JWeLPYyPpG4`,
  elena: `${AVATAR_BASE}/AB6AXuDbByIaEXq4DFIzqg6aNGh8b-WO7sC1NVcGrtW45aUIy1rZMX5HsI3lZQFbgwMhfcpNHN39TloLvDpLkcNC4USZHkYzG09vGKd3v9k_47vYfq3QdHIDGpxh0ypienVLs_OimomkYFaZNvWkxLL4EQOK7y5289EzM6nRyOPTKBuS1TtWDLjNP5vxtJHJCHBdLocM-2RssYlb8a8Rm2Af_4yMatT_mQf3AxupLaW5WUgYXWE6K8KOPQuiW_04niH76wpOaXPyaIuhttQ`,
  marcus: `${AVATAR_BASE}/AB6AXuAASkcyGXfZRTRoz55g6pkyUkUezuq5Sk7s_SxsXbw--bQhx9FBLD_BUVCHlGj9UoQSfdy0hAyecumrQHkiBD3gli86SLjOQQfXTCNMLR4PSoWeXhtpIsX5VTvvpVDDR9ozfJtDi6dqbzsgMn2vhchNPIUR1Gvo6ih1kes-bnqE-g2thlrpGr1kts-TZc9NRS-qhlel9iS7bqgQbiRCVpfLLfSTwBiNnz-QIkvPy2mPA1e5yEPitTp6NkZARCx47_Obq92rUYryAjM`,
  group: `${AVATAR_BASE}/AB6AXuDi2C2idV6qd7iqEixOTexspheoc4Rr7PeDGDrIvi0CHCcdX-2IfXwQqc3fESwqCg9wMvmC4q67NQd3JJNG6iUxm1zUs7b5KW39WjZ0s1usfwBO8zq48eOCbu2ef4UI9aXmvnTdzGFLPSV22WLmWkL2ieT-D9tb20kB64wTuA-f2MsbT2i3rn5lL4CzZebF3rQuG7hWUYhmwoEXggbjb4Dh3VxOH841JrGLt1JKabCGgXV21VeygRgQF8GNOoXSd3Di-jFs25CfN_s`,
  sarah: `${AVATAR_BASE}/AB6AXuBM4N56yGNrFN5SpbFn-qcY-gUopRjPwEwj6DZFAVeCc6t1xsJ7gfCKD1PO7KntZ_7huVhV1nZzQAa-S9SGqiJK1yUHC1aR4e3tVZ4VvS3hSYJo2rwo1mjsWBbh4K4OyCY8X8lQCA1uMKf9loOV7R6gW_gANuQLrCnn8lvUSk5W0B6ZjZmyb0D7skGGJrST9cQ2NqhIWsRuQ4vWcYPRT4f22z6NARb2mXUBY8rShLz_RrmSOLCGUit2J0qSUMS77lws_hRqs-Nay6Q`,
  profile: `${AVATAR_BASE}/AB6AXuCkXsd9vsDEUqN_he_-eR-wxCZmm8OZaudo5DK_hrKdfaWdjbDaVKKhWYPT-DRHNJR5shaBx_q0rf4fN0kq7irpWPvEweYyzjqizU7pUne4aU-ohWqASRWD1G6Rp5lXQnDHkYEvN81vEs6zuUit5f2FJuqqOuuEwlFoEsgxlrI4LrruCjTdT3zkAksa68NP5J9dmIy-VhhyQDxlEsCoRCHrgd8VL79GN9y98TXwX6UkQUPOAS3YWePx0WOQpiwo2SRtgyBBIszWTcM`,
  sharedImage: `${AVATAR_BASE}/AB6AXuAFvLSjdoh8tvHYNcGnMCKs7JlBJr3Suh9sIOou-6mFBbVILmtj_bvX_9kFBIwCB5kBeT1HMMhgbP40-Wt812_REQy3rO61WG8onM7MgIeAp5CzprqM4aGZ77Afrcdcg2uRkHqhjLeCdVeDlJlx4-8otuHX59jSIexJ7ymP9os0qbef-hrPkoAQAQ7JnSeZsbexMpjfDzk-dMF0l083eR3h86zfUwINQNnXOMRMUh53pQr0ioWY4UI4lnmXbMboNG-Fm4tqDm8YAF0`,
} as const;

export interface Conversation {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  isGroup?: boolean;
  members?: number;
}

export const CONVERSATIONS: Conversation[] = [
  {
    id: 'alex',
    name: 'Alex Rivera',
    avatar: AVATARS.alex,
    lastMessage: 'The encryption keys are synchronized for the next node...',
    time: '12:45 PM',
    unread: 2,
    online: true,
  },
  {
    id: 'group',
    name: 'Design System Squad',
    avatar: AVATARS.group,
    lastMessage: 'Sarah: #Release-v2 is looking solid.',
    time: '11:02 AM',
    unread: 5,
    online: true,
    isGroup: true,
    members: 8,
  },
  {
    id: 'jordan',
    name: 'Jordan Vance',
    avatar: AVATARS.jordan,
    lastMessage: "Let's review the quarterly neural metrics tomorrow.",
    time: '10:20 AM',
    unread: 0,
    online: false,
  },
  {
    id: 'nova',
    name: 'Nova System',
    avatar: AVATARS.nova,
    lastMessage: 'System update complete. 14 new modules enabled.',
    time: 'Yesterday',
    unread: 1,
    online: true,
  },
  {
    id: 'elena',
    name: 'Elena Thorne',
    avatar: AVATARS.elena,
    lastMessage: 'Did you see the new architectural render for the orbital base?',
    time: 'Yesterday',
    unread: 0,
    online: false,
  },
  {
    id: 'marcus',
    name: 'Marcus Chen',
    avatar: AVATARS.marcus,
    lastMessage: "I've uploaded the schematics to the shared drive.",
    time: 'Aug 22',
    unread: 0,
    online: true,
  },
];

export interface Message {
  id: string;
  text?: string;
  image?: string;
  time: string;
  outgoing: boolean;
  read?: boolean;
  // Group chats only
  senderName?: string;
  senderAvatar?: string;
  senderColor?: string;
}

export const DIRECT_MESSAGES: Record<string, Message[]> = {
  alex: [
    {
      id: '1',
      text: 'The architecture for the new neural processing unit looks incredible. Have you seen the latest benchmarks?',
      time: '10:42 AM',
      outgoing: false,
    },
    {
      id: '2',
      text: "Just reviewed them. The throughput efficiency is up by 40%. It's a game changer for real-time synthesis.",
      time: '10:44 AM',
      outgoing: true,
      read: true,
    },
    {
      id: '3',
      text: "I'm pushing the updated documentation to the repo now. Check the main branch.",
      time: '10:45 AM',
      outgoing: true,
      read: true,
    },
    {
      id: '4',
      image: AVATARS.sharedImage,
      time: '10:48 AM',
      outgoing: false,
    },
  ],
};

export const GROUP_MESSAGES: Message[] = [
  {
    id: '1',
    text: 'Hey team, has everyone seen the new @DesignTokens update? It includes the glassmorphism variables we needed.',
    time: '10:42 AM',
    outgoing: false,
    senderName: 'Alex Riviera',
    senderAvatar: AVATARS.alex,
    senderColor: '#4edea3',
  },
  {
    id: '2',
    text: 'Attaching the moodboards for the v2.0 update. @Everyone thoughts?',
    image: AVATARS.sharedImage,
    time: '10:45 AM',
    outgoing: false,
    senderName: 'Jordan Smith',
    senderAvatar: AVATARS.jordan,
    senderColor: '#d0bcff',
  },
  {
    id: '3',
    text: "The translucency and inner borders in those previews look incredible. Matches the cerebral vibe perfectly. Let's merge the tokens today!",
    time: '10:48 AM',
    outgoing: true,
    read: true,
  },
  {
    id: '4',
    text: "Agreed. #Release-v2 is looking solid. I'll finish the responsive pivot tests by noon.",
    time: '10:50 AM',
    outgoing: false,
    senderName: 'Sarah Chen',
    senderAvatar: AVATARS.sarah,
    senderColor: '#ffb4ab',
  },
];
