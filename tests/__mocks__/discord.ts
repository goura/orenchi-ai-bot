// Mock Discord.js classes and types for testing
export class MockUser {
  id: string;
  username: string;
  
  constructor(id: string, username: string) {
    this.id = id;
    this.username = username;
  }
}

export class MockChannel {
  id: string;
  name: string;
  messages: MockMessage[];
  
  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.messages = [];
  }
  
  async send(content: string) {
    const message = new MockMessage(content, this);
    this.messages.push(message);
    return message;
  }
}

export class MockMessage {
  content: string;
  channel: MockChannel;
  author: MockUser;
  
  constructor(content: string, channel: MockChannel, author?: MockUser) {
    this.content = content;
    this.channel = channel;
    this.author = author || new MockUser("mock-user-id", "mock-user");
  }
}

export class MockClient {
  user: { id: string };
  
  constructor() {
    this.user = { id: "mock-bot-id" };
  }
  
  async login(token: string) {
    // Mock login
    return "mock-token";
  }
  
  on(event: string, callback: Function) {
    // Mock event listener
  }
}