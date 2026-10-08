from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Optional
import os, uuid
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, String, Text, DateTime, Boolean, ForeignKey, Integer, UniqueConstraint, Index, event, select, or_
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker, Session

DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./signal.db')
_engine_args = {'check_same_thread': False} if DATABASE_URL.startswith('sqlite') else {}
engine = create_engine(DATABASE_URL, connect_args=_engine_args)
if DATABASE_URL.startswith('sqlite'):
    @event.listens_for(engine, 'connect')
    def _sqlite_pragmas(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor(); cursor.execute('PRAGMA foreign_keys=ON'); cursor.execute('PRAGMA journal_mode=WAL'); cursor.close()
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
class Base(DeclarativeBase): pass

def now(): return datetime.now(timezone.utc)
def uid(): return str(uuid.uuid4())
class User(Base):
    __tablename__='users'; id:Mapped[str]=mapped_column(String,primary_key=True,default=uid); phone_number:Mapped[Optional[str]]=mapped_column(String,unique=True); username:Mapped[Optional[str]]=mapped_column(String,unique=True); display_name:Mapped[str]=mapped_column(String,default=''); about:Mapped[str]=mapped_column(String,default='Hey there! I am using Signal.'); avatar_url:Mapped[Optional[str]]=mapped_column(String); avatar_color:Mapped[str]=mapped_column(String,default='#8298c9'); is_online:Mapped[bool]=mapped_column(Boolean,default=False); last_seen_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now); created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class Otp(Base):
    __tablename__='otp_challenges'; id:Mapped[str]=mapped_column(String,primary_key=True,default=uid); identifier:Mapped[str]=mapped_column(String); code:Mapped[str]=mapped_column(String); expires_at:Mapped[datetime]=mapped_column(DateTime(timezone=True)); consumed_at:Mapped[Optional[datetime]]=mapped_column(DateTime(timezone=True))
class Contact(Base):
    __tablename__='contacts'; __table_args__=(UniqueConstraint('owner_id','contact_user_id'),); id:Mapped[str]=mapped_column(String,primary_key=True,default=uid); owner_id:Mapped[str]=mapped_column(ForeignKey('users.id',ondelete='CASCADE')); contact_user_id:Mapped[str]=mapped_column(ForeignKey('users.id',ondelete='CASCADE')); nickname:Mapped[Optional[str]]=mapped_column(String); is_blocked:Mapped[bool]=mapped_column(Boolean,default=False); created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class Conversation(Base):
    __tablename__='conversations'; id:Mapped[str]=mapped_column(String,primary_key=True,default=uid); type:Mapped[str]=mapped_column(String,default='direct'); title:Mapped[Optional[str]]=mapped_column(String); created_by:Mapped[str]=mapped_column(ForeignKey('users.id')); direct_key:Mapped[Optional[str]]=mapped_column(String,unique=True); disappearing_timer_seconds:Mapped[Optional[int]]=mapped_column(Integer); last_message_id:Mapped[Optional[str]]=mapped_column(String); last_activity_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now,index=True); created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
class Participant(Base):
    __tablename__='conversation_participants'; __table_args__=(UniqueConstraint('conversation_id','user_id'),); id:Mapped[str]=mapped_column(String,primary_key=True,default=uid); conversation_id:Mapped[str]=mapped_column(ForeignKey('conversations.id',ondelete='CASCADE'),index=True); user_id:Mapped[str]=mapped_column(ForeignKey('users.id',ondelete='CASCADE'),index=True); role:Mapped[str]=mapped_column(String,default='member'); last_read_at:Mapped[Optional[datetime]]=mapped_column(DateTime(timezone=True)); is_archived:Mapped[bool]=mapped_column(Boolean,default=False); is_pinned:Mapped[bool]=mapped_column(Boolean,default=False); muted_until:Mapped[Optional[datetime]]=mapped_column(DateTime(timezone=True))
class Message(Base):
    __tablename__='messages'; __table_args__=(UniqueConstraint('sender_id','client_message_id'),Index('ix_messages_conversation_created','conversation_id','created_at')); id:Mapped[str]=mapped_column(String,primary_key=True,default=uid); conversation_id:Mapped[str]=mapped_column(ForeignKey('conversations.id',ondelete='CASCADE'),index=True); sender_id:Mapped[str]=mapped_column(ForeignKey('users.id')); body:Mapped[str]=mapped_column(Text); type:Mapped[str]=mapped_column(String,default='text'); client_message_id:Mapped[str]=mapped_column(String); created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now); deleted_at:Mapped[Optional[datetime]]=mapped_column(DateTime(timezone=True))
class Receipt(Base):
    __tablename__='message_receipts'; __table_args__=(UniqueConstraint('message_id','user_id'),); id:Mapped[str]=mapped_column(String,primary_key=True,default=uid); message_id:Mapped[str]=mapped_column(ForeignKey('messages.id',ondelete='CASCADE')); user_id:Mapped[str]=mapped_column(ForeignKey('users.id')); status:Mapped[str]=mapped_column(String,default='delivered'); delivered_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now); read_at:Mapped[Optional[datetime]]=mapped_column(DateTime(timezone=True))
class Reaction(Base):
    __tablename__='message_reactions'; __table_args__=(UniqueConstraint('message_id','user_id'),); id:Mapped[str]=mapped_column(String,primary_key=True,default=uid); message_id:Mapped[str]=mapped_column(ForeignKey('messages.id',ondelete='CASCADE')); user_id:Mapped[str]=mapped_column(ForeignKey('users.id',ondelete='CASCADE')); emoji:Mapped[str]=mapped_column(String); created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)

class WsHub:
    def __init__(self): self.sockets:dict[str,set[WebSocket]]={}
    async def connect(self,user_id:str,ws:WebSocket): await ws.accept(); self.sockets.setdefault(user_id,set()).add(ws)
    def disconnect(self,user_id:str,ws:WebSocket): self.sockets.get(user_id,set()).discard(ws)
    async def send(self,user_id:str,event:str,payload:dict):
        for ws in tuple(self.sockets.get(user_id,set())):
            try: await ws.send_json({'type':event,'payload':payload})
            except Exception: self.disconnect(user_id,ws)
    async def conversation(self,db:Session,cid:str,event:str,payload:dict,exclude:Optional[str]=None):
        for p in db.scalars(select(Participant).where(Participant.conversation_id==cid)):
            if p.user_id!=exclude: await self.send(p.user_id,event,payload)
hub=WsHub()
def get_db():
    db=SessionLocal()
    try: yield db
    finally: db.close()
def public_user(u:User): return {'id':u.id,'phone_number':u.phone_number,'username':u.username,'display_name':u.display_name,'about':u.about,'avatar_url':u.avatar_url,'avatar_color':u.avatar_color,'is_online':u.is_online,'last_seen_at':u.last_seen_at}
def token_user(token:str,db:Session)->User:
    user=db.scalar(select(User).where(User.id==token.removeprefix('demo-')))
    if not user: raise HTTPException(401,'Invalid or expired token')
    return user
def current_user(authorization:Optional[str]=None,db:Session=Depends(get_db)):
    if not authorization or not authorization.startswith('Bearer '): raise HTTPException(401,'Bearer token required')
    return token_user(authorization[7:],db)
def user_dep(authorization:Optional[str]=__import__('fastapi').Header(default=None),db:Session=Depends(get_db)): return current_user(authorization,db)
def require_member(db:Session,cid:str,uid_:str):
    p=db.scalar(select(Participant).where(Participant.conversation_id==cid,Participant.user_id==uid_))
    if not p: raise HTTPException(403,'Conversation membership required')
    return p
def msg_json(m:Message,db:Session):
    sender=db.get(User,m.sender_id)
    return {'id':m.id,'conversation_id':m.conversation_id,'sender_id':m.sender_id,'sender':public_user(sender),'body':m.body,'type':m.type,'client_message_id':m.client_message_id,'created_at':m.created_at,'deleted_at':m.deleted_at}

app=FastAPI(title='Signal Clone API',version='1.0.0')
origins=os.getenv('CORS_ORIGINS','http://localhost:3000').split(',')
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_credentials=True,allow_methods=['*'],allow_headers=['*'])
@app.on_event('startup')
def startup():
    if os.getenv('TESTING') == '1':
        return
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if not db.scalar(select(User).limit(1)): seed(db)
@app.get('/health')
def health(): return {'status':'ok'}
class OtpRequest(BaseModel): identifier:str=Field(min_length=3,max_length=120)
class OtpVerify(BaseModel): identifier:str; code:str
class Profile(BaseModel): display_name:str=Field(min_length=1,max_length=80); about:Optional[str]=Field(default=None,max_length=240)
class DirectCreate(BaseModel): user_id:str
class ContactCreate(BaseModel): user_id:Optional[str]=None; identifier:Optional[str]=None
class ReactionInput(BaseModel): emoji:str=Field(min_length=1,max_length=16)
class SendMessage(BaseModel): body:str=Field(min_length=1,max_length=10000); client_message_id:str; reply_to_id:Optional[str]=None
class GroupCreate(BaseModel): name:str=Field(min_length=1,max_length=100); member_ids:list[str]=[]
class AddMembers(BaseModel): user_ids:list[str]
class ReadUpTo(BaseModel): up_to_message_id:str
class UpdateConversation(BaseModel): is_pinned:Optional[bool]=None; is_archived:Optional[bool]=None; disappearing_timer_seconds:Optional[int]=None

@app.post('/api/v1/auth/request-otp')
def request_otp(body:OtpRequest,db:Session=Depends(get_db)):
    db.add(Otp(identifier=body.identifier,code=os.getenv('OTP_CODE','123456'),expires_at=now()+timedelta(minutes=10))); db.commit(); return {'ok':True,'hint':'Use 123456'}
@app.post('/api/v1/auth/verify-otp')
def verify_otp(body:OtpVerify,db:Session=Depends(get_db)):
    challenge=db.scalar(select(Otp).where(Otp.identifier==body.identifier,Otp.consumed_at.is_(None)).order_by(Otp.expires_at.desc()))
    # SQLite returns naive datetimes even though values are stored in UTC.
    expiry = challenge.expires_at.replace(tzinfo=timezone.utc) if challenge and challenge.expires_at.tzinfo is None else (challenge.expires_at if challenge else now())
    if body.code!=os.getenv('OTP_CODE','123456') or not challenge or expiry<now(): raise HTTPException(401,'Invalid or expired verification code')
    challenge.consumed_at=now(); user=db.scalar(select(User).where(or_(User.phone_number==body.identifier,User.username==body.identifier)))
    fresh=user is None
    if fresh: user=User(phone_number=body.identifier if body.identifier.startswith('+') else None,username=None if body.identifier.startswith('+') else body.identifier,display_name=''); db.add(user)
    db.commit(); db.refresh(user); return {'token':'demo-'+user.id,'user':public_user(user),'is_new_user':fresh}
@app.get('/api/v1/auth/me')
def me(user:User=Depends(user_dep)): return public_user(user)
@app.put('/api/v1/auth/profile')
def profile(body:Profile,db:Session=Depends(get_db),user:User=Depends(user_dep)):
    user.display_name=body.display_name
    if body.about is not None:user.about=body.about
    db.commit();return public_user(user)
@app.post('/api/v1/auth/logout')
def logout():return {'ok':True}
@app.get('/api/v1/users/search')
def search_users(q:str=Query(min_length=1),db:Session=Depends(get_db),user:User=Depends(user_dep)):
    return [public_user(u) for u in db.scalars(select(User).where(User.id!=user.id,or_(User.display_name.ilike(f'%{q}%'),User.phone_number.ilike(f'%{q}%'),User.username.ilike(f'%{q}%'))).limit(20))]
@app.patch('/api/v1/users/me')
def edit_me(body:Profile,db:Session=Depends(get_db),user:User=Depends(user_dep)): return profile(body,db,user)
@app.get('/api/v1/contacts')
def contacts(db:Session=Depends(get_db),user:User=Depends(user_dep)):
    rows=db.scalars(select(Contact).where(Contact.owner_id==user.id)).all()
    return [{'id':row.id,'user':public_user(db.get(User,row.contact_user_id)),'nickname':row.nickname,'is_blocked':row.is_blocked} for row in rows]
@app.post('/api/v1/contacts')
def add_contact(body:ContactCreate,db:Session=Depends(get_db),user:User=Depends(user_dep)):
    other=db.get(User,body.user_id) if body.user_id else db.scalar(select(User).where(or_(User.phone_number==body.identifier,User.username==body.identifier)))
    if not other:raise HTTPException(404,'User not found')
    if other.id==user.id:raise HTTPException(422,'Cannot add yourself as a contact')
    row=db.scalar(select(Contact).where(Contact.owner_id==user.id,Contact.contact_user_id==other.id))
    if not row:row=Contact(owner_id=user.id,contact_user_id=other.id);db.add(row);db.commit();db.refresh(row)
    return {'id':row.id,'user':public_user(other),'nickname':row.nickname,'is_blocked':row.is_blocked}
@app.delete('/api/v1/contacts/{contact_id}')
def remove_contact(contact_id:str,db:Session=Depends(get_db),user:User=Depends(user_dep)):
    row=db.scalar(select(Contact).where(Contact.id==contact_id,Contact.owner_id==user.id))
    if not row:raise HTTPException(404,'Contact not found')
    db.delete(row);db.commit();return {'ok':True}
@app.post('/api/v1/contacts/{contact_id}/block')
def block_contact(contact_id:str,db:Session=Depends(get_db),user:User=Depends(user_dep)):
    row=db.scalar(select(Contact).where(Contact.id==contact_id,Contact.owner_id==user.id))
    if not row:raise HTTPException(404,'Contact not found')
    row.is_blocked=not row.is_blocked;db.commit();return {'is_blocked':row.is_blocked}
@app.get('/api/v1/conversations')
def conversations(q:Optional[str]=None,db:Session=Depends(get_db),user:User=Depends(user_dep)):
    parts=db.scalars(select(Participant).where(Participant.user_id==user.id,Participant.is_archived.is_(False))).all(); output=[]
    for p in parts:
        c=db.get(Conversation,p.conversation_id); members=db.scalars(select(Participant).where(Participant.conversation_id==c.id,Participant.user_id!=user.id)).all(); others=[db.get(User,x.user_id) for x in members]
        if q and not any(q.casefold() in ((x.display_name or '')+' '+(x.username or '')).casefold() for x in others) and not (c.title and q.casefold() in c.title.casefold()):continue
        last=db.get(Message,c.last_message_id) if c.last_message_id else None
        output.append({'id':c.id,'type':c.type,'title':c.title if c.type=='group' else (others[0].display_name if others else 'Unknown'),'participants':[public_user(x) for x in others if x],'last_message':msg_json(last,db) if last else None,'last_activity_at':c.last_activity_at,'unread_count':0,'is_pinned':p.is_pinned,'muted_until':p.muted_until,'is_online':bool(others and others[0].is_online),'avatar_color':others[0].avatar_color if others else '#3A76F0'})
    output.sort(key=lambda x:x['last_activity_at'],reverse=True)
    output.sort(key=lambda x:x['is_pinned'],reverse=True)
    return output
@app.post('/api/v1/conversations/direct')
def direct(body:DirectCreate,db:Session=Depends(get_db),user:User=Depends(user_dep)):
    if not db.get(User,body.user_id):raise HTTPException(404,'User not found')
    key=':'.join(sorted([user.id,body.user_id])); c=db.scalar(select(Conversation).where(Conversation.direct_key==key))
    if not c:
        c=Conversation(type='direct',created_by=user.id,direct_key=key);db.add(c);db.flush();db.add_all([Participant(conversation_id=c.id,user_id=user.id,role='admin'),Participant(conversation_id=c.id,user_id=body.user_id)]);db.commit()
    return {'id':c.id,'type':c.type,'title':None}
@app.get('/api/v1/conversations/{cid}')
def conversation_detail(cid:str,db:Session=Depends(get_db),user:User=Depends(user_dep)):
    require_member(db,cid,user.id);c=db.get(Conversation,cid);ps=db.scalars(select(Participant).where(Participant.conversation_id==cid)).all();return {'id':c.id,'type':c.type,'title':c.title,'disappearing_timer_seconds':c.disappearing_timer_seconds,'participants':[{'role':p.role,'user':public_user(db.get(User,p.user_id))} for p in ps]}
@app.get('/api/v1/conversations/{cid}/messages')
def messages(cid:str,before:Optional[str]=None,limit:int=30,db:Session=Depends(get_db),user:User=Depends(user_dep)):
    require_member(db,cid,user.id);stmt=select(Message).where(Message.conversation_id==cid,Message.deleted_at.is_(None)).order_by(Message.created_at.desc()).limit(min(limit,100))
    if before:
        cursor=db.get(Message,before)
        if cursor:stmt=stmt.where(Message.created_at<cursor.created_at)
    return [msg_json(m,db) for m in reversed(db.scalars(stmt).all())]
def persist_message(db:Session,cid:str,user:User,body:SendMessage):
    require_member(db,cid,user.id);existing=db.scalar(select(Message).where(Message.sender_id==user.id,Message.client_message_id==body.client_message_id))
    if existing:return existing
    message=Message(conversation_id=cid,sender_id=user.id,body=body.body,client_message_id=body.client_message_id);db.add(message);db.flush();c=db.get(Conversation,cid);c.last_message_id=message.id;c.last_activity_at=now()
    for p in db.scalars(select(Participant).where(Participant.conversation_id==cid,Participant.user_id!=user.id)):db.add(Receipt(message_id=message.id,user_id=p.user_id))
    db.commit();db.refresh(message);return message
@app.post('/api/v1/conversations/{cid}/messages')
async def send_message(cid:str,body:SendMessage,db:Session=Depends(get_db),user:User=Depends(user_dep)):
    m=persist_message(db,cid,user,body); payload={'message':msg_json(m,db),'conversation_id':cid};await hub.conversation(db,cid,'message.new',payload,exclude=user.id); return payload['message']
@app.post('/api/v1/conversations/{cid}/read')
async def mark_read(cid:str,body:ReadUpTo,db:Session=Depends(get_db),user:User=Depends(user_dep)):
    require_member(db,cid,user.id);p=db.scalar(select(Participant).where(Participant.conversation_id==cid,Participant.user_id==user.id));p.last_read_at=now()
    for r in db.scalars(select(Receipt).join(Message).where(Message.conversation_id==cid,Receipt.user_id==user.id)):r.status='read';r.read_at=now()
    db.commit();await hub.conversation(db,cid,'message.status',{'message_id':body.up_to_message_id,'user_id':user.id,'status':'read'},exclude=user.id);return {'ok':True}
@app.patch('/api/v1/conversations/{cid}')
def update_conversation(cid:str,body:UpdateConversation,db:Session=Depends(get_db),user:User=Depends(user_dep)):
    p=require_member(db,cid,user.id);c=db.get(Conversation,cid)
    for key in ('is_pinned','is_archived'):
        value=getattr(body,key)
        if value is not None:setattr(p,key,value)
    if body.disappearing_timer_seconds is not None:c.disappearing_timer_seconds=body.disappearing_timer_seconds
    db.commit();return {'ok':True}
@app.post('/api/v1/groups')
def create_group(body:GroupCreate,db:Session=Depends(get_db),user:User=Depends(user_dep)):
    c=Conversation(type='group',title=body.name,created_by=user.id);db.add(c);db.flush();db.add(Participant(conversation_id=c.id,user_id=user.id,role='admin'))
    for uid_ in set(body.member_ids):
        if db.get(User,uid_):db.add(Participant(conversation_id=c.id,user_id=uid_))
    db.commit();return {'id':c.id,'type':'group','title':c.title}
@app.get('/api/v1/groups/{cid}/members')
def group_members(cid:str,db:Session=Depends(get_db),user:User=Depends(user_dep)):
    require_member(db,cid,user.id);return [{'user':public_user(db.get(User,p.user_id)),'role':p.role} for p in db.scalars(select(Participant).where(Participant.conversation_id==cid))]
@app.post('/api/v1/groups/{cid}/members')
async def add_members(cid:str,body:AddMembers,db:Session=Depends(get_db),user:User=Depends(user_dep)):
    p=require_member(db,cid,user.id)
    if p.role!='admin':raise HTTPException(403,'Admin role required')
    for uid_ in set(body.user_ids):
        if db.get(User,uid_) and not db.scalar(select(Participant).where(Participant.conversation_id==cid,Participant.user_id==uid_)):db.add(Participant(conversation_id=cid,user_id=uid_))
    db.commit();await hub.conversation(db,cid,'conversation.updated',{'conversation_id':cid});return {'ok':True}
@app.delete('/api/v1/groups/{cid}/members/{uid_}')
def remove_member(cid:str,uid_:str,db:Session=Depends(get_db),user:User=Depends(user_dep)):
    actor=require_member(db,cid,user.id);target=require_member(db,cid,uid_)
    if actor.role!='admin' and uid_!=user.id:raise HTTPException(403,'Admin role required')
    db.delete(target);db.commit();return {'ok':True}
@app.patch('/api/v1/groups/{cid}/members/{uid_}/role')
def change_member_role(cid:str,uid_:str,body:dict,db:Session=Depends(get_db),user:User=Depends(user_dep)):
    actor=require_member(db,cid,user.id);target=require_member(db,cid,uid_)
    if actor.role!='admin':raise HTTPException(403,'Admin role required')
    role=body.get('role')
    if role not in ('admin','member'):raise HTTPException(422,'role must be admin or member')
    target.role=role;db.commit();return {'ok':True,'role':role}
@app.put('/api/v1/messages/{mid}/reaction')
def set_reaction(mid:str,body:ReactionInput,db:Session=Depends(get_db),user:User=Depends(user_dep)):
    message=db.get(Message,mid)
    if not message:raise HTTPException(404,'Message not found')
    require_member(db,message.conversation_id,user.id)
    reaction=db.scalar(select(Reaction).where(Reaction.message_id==mid,Reaction.user_id==user.id))
    if reaction:reaction.emoji=body.emoji
    else:db.add(Reaction(message_id=mid,user_id=user.id,emoji=body.emoji))
    db.commit();return {'ok':True,'emoji':body.emoji}
@app.delete('/api/v1/messages/{mid}/reaction')
def remove_reaction(mid:str,db:Session=Depends(get_db),user:User=Depends(user_dep)):
    reaction=db.scalar(select(Reaction).where(Reaction.message_id==mid,Reaction.user_id==user.id))
    if reaction:db.delete(reaction);db.commit()
    return {'ok':True}
@app.patch('/api/v1/messages/{mid}')
def delete_message(mid:str,db:Session=Depends(get_db),user:User=Depends(user_dep)):
    m=db.get(Message,mid)
    if not m:raise HTTPException(404,'Message not found')
    if m.sender_id!=user.id:raise HTTPException(403,'Only sender can delete')
    m.deleted_at=now();m.body='This message was deleted';db.commit();return {'ok':True}
@app.websocket('/ws')
async def websocket_endpoint(ws:WebSocket,token:str=Query(default='')):
    with SessionLocal() as db:
        try:user=token_user(token,db)
        except HTTPException:await ws.close(code=4401);return
        await hub.connect(user.id,ws);user.is_online=True;db.commit()
        try:
            while True:
                data=await ws.receive_json();kind=data.get('type');payload=data.get('payload',{})
                if kind=='ping':await hub.send(user.id,'pong',{})
                elif kind=='message.send':
                    try:
                        msg=persist_message(db,payload['conversation_id'],user,SendMessage(**payload));serialized=msg_json(msg,db)
                        await hub.send(user.id,'message.ack',{'client_message_id':payload['client_message_id'],'message_id':msg.id,'status':'sent'})
                        await hub.conversation(db,msg.conversation_id,'message.new',{'message':serialized,'conversation_id':msg.conversation_id},exclude=user.id)
                    except Exception as exc:await hub.send(user.id,'error',{'message':str(exc)})
                elif kind in ('typing.start','typing.stop'):
                    await hub.conversation(db,payload['conversation_id'],'typing',{'conversation_id':payload['conversation_id'],'user_id':user.id,'is_typing':kind.endswith('start')},exclude=user.id)
                elif kind=='conversation.read':
                    cid=payload['conversation_id'];require_member(db,cid,user.id); await hub.conversation(db,cid,'message.status',{'message_id':payload.get('up_to_message_id'),'user_id':user.id,'status':'read'},exclude=user.id)
        except WebSocketDisconnect:hub.disconnect(user.id,ws);user.is_online=bool(hub.sockets.get(user.id));user.last_seen_at=now();db.commit()


def seed(db:Session):
    names=['Aarav Mehta','Isha Kapoor','Rohan Shah','Maya Iyer','Kabir Rao','Ananya Das','Vivaan Nair','Sara Khan','Dev Patel','Neha Bose']
    colors=['#86a8e7','#e69a9a','#89bd9b','#c19adf','#e6b476','#72bfc0','#e18ab0','#a7ad69','#8b9bd1','#d88e72']; users=[]
    for i,name in enumerate(names):
        u=User(phone_number=f'+91 90000 0000{i+1}',username=name.split()[0].lower(),display_name=name,about='Hey there! I am using Signal.',avatar_color=colors[i],is_online=i in (0,1,3),last_seen_at=now()-timedelta(minutes=i*13));db.add(u);users.append(u)
    db.flush(); demo=users[0]
    for u in users[1:]:
        key=':'.join(sorted([demo.id,u.id]));c=Conversation(type='direct',created_by=demo.id,direct_key=key,last_activity_at=now()-timedelta(hours=users.index(u)));db.add(c);db.flush();db.add_all([Participant(conversation_id=c.id,user_id=demo.id,role='admin',is_pinned=u==users[1]),Participant(conversation_id=c.id,user_id=u.id)])
        for n in range(18):
            sender=demo if n%2 else u;m=Message(conversation_id=c.id,sender_id=sender.id,body=['Hey! How have you been?','Just saw your message 🙂','Want to catch up this week?','Sounds good, see you then!'][n%4],client_message_id=f'seed-{c.id}-{n}',created_at=now()-timedelta(days=n//5,hours=n%6));db.add(m);db.flush();c.last_message_id=m.id
            if sender!=demo:db.add(Receipt(message_id=m.id,user_id=demo.id))
    for ix,title in enumerate(['Weekend plans 🌿','Design team','College friends']):
        c=Conversation(type='group',title=title,created_by=users[ix].id,last_activity_at=now()-timedelta(hours=ix+1));db.add(c);db.flush()
        for u in users[ix:ix+5]:db.add(Participant(conversation_id=c.id,user_id=u.id,role='admin' if u==users[ix] else 'member'))
        for n in range(16):
            m=Message(conversation_id=c.id,sender_id=users[(ix+n)%8].id,body=['Anyone free Saturday?','That sounds perfect!','I will bring snacks 🍪','On my way!'][n%4],client_message_id=f'group-{ix}-{n}',created_at=now()-timedelta(days=n//4,hours=n%6));db.add(m);db.flush();c.last_message_id=m.id
    db.commit()
