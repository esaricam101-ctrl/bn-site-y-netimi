import { Global, Module } from '@nestjs/common';
import { OutboxServisi } from './outbox.service';
import { OutboxYayincisi } from './outbox.publisher';

@Global()
@Module({ providers: [OutboxServisi, OutboxYayincisi], exports: [OutboxServisi] })
export class OutboxModule {}
