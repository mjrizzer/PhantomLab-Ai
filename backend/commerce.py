"""Two explicitly fictional shop releases. No payment integrations or real credentials."""
import asyncio
import uuid
from fastapi import APIRouter, Request, Response, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from .store import Session, Order, get, put
from pathlib import Path

router = APIRouter(prefix='/demo')
CATALOG = [
    {'id': 'vessel', 'name': 'The Quiet Vessel', 'category': 'Ceramics', 'price': 4800, 'color': '#B99179', 'shape': 'vessel'},
    {'id': 'lamp', 'name': 'Folded Light', 'category': 'Lighting', 'price': 12800, 'color': '#AFA18B', 'shape': 'lamp'},
    {'id': 'linen', 'name': 'Sunday Linen', 'category': 'Textiles', 'price': 3600, 'color': '#C9BEA6', 'shape': 'linen'},
    {'id': 'bowl', 'name': 'Low Tide Bowl', 'category': 'Ceramics', 'price': 6200, 'color': '#7D8C79', 'shape': 'bowl'},
]
class CartInput(BaseModel):
    product: str
    quantity: int = Field(ge=0, le=20)
class CheckoutInput(BaseModel):
    key: str = Field(min_length=8, max_length=80)
    discount: str = Field(default='', max_length=20)
    delay_ms: int = Field(default=0, ge=0, le=1500)
def valid(release):
    if release not in ('A', 'B'):
        raise HTTPException(404, 'Unknown release')
def identity(request, response):
    sid = request.cookies.get('atelier_session', '')
    try:
        uuid.UUID(sid)
    except ValueError:
        sid = str(uuid.uuid4())
    response.set_cookie('atelier_session', sid, httponly=True, samesite='strict', path='/demo')
    return sid
def total(cart, code, release):
    subtotal = sum(next(p['price'] for p in CATALOG if p['id'] == k) * q for k, q in cart.items())
    # B applies 5% rather than the advertised 10%; integer arithmetic is intentional.
    percent = (10 if release == 'A' else 5) if code.upper() == 'STUDIO10' else 0
    return subtotal - subtotal * percent // 100
@router.get('/{release}', response_class=HTMLResponse)
async def shop(release: str):
    valid(release)
    return (Path(__file__).parent / 'templates' / 'commerce.html').read_text(encoding='utf-8').replace('__RELEASE__', release)
@router.get('/{release}/api/state')
async def state(release: str, request: Request, response: Response):
    valid(release)
    sid = identity(request, response)
    cart = get(f'cart:{release}:{sid}') or {}
    with Session() as db:
        orders = db.query(Order).filter_by(session=sid, release=release).order_by(Order.created).all()
        return {'catalog': CATALOG, 'cart': cart, 'orders': [{'id': o.id, 'total_cents': o.total_cents, 'created': o.created} for o in orders]}
@router.put('/{release}/api/cart')
async def cart(release: str, body: CartInput, request: Request, response: Response):
    valid(release)
    if body.product not in {p['id'] for p in CATALOG}:
        raise HTTPException(422, 'Unknown product')
    sid = identity(request, response)
    items = get(f'cart:{release}:{sid}') or {}
    items[body.product] = body.quantity
    put('cart', f'cart:{release}:{sid}', {k: v for k, v in items.items() if v})
    return {'saved': True}
@router.post('/{release}/api/checkout')
async def checkout(release: str, body: CheckoutInput, request: Request, response: Response):
    valid(release)
    sid = identity(request, response)
    items = get(f'cart:{release}:{sid}') or {}
    with Session() as db:
        prior = db.query(Order).filter_by(release=release, session=sid, checkout_key=body.key).first()
        if prior and release == 'A':
            return {'id': prior.id, 'total_cents': prior.total_cents, 'reused': True}
    if not items:
        raise HTTPException(409, 'Your bag is empty')
    # Delay provides a reproducible race window, also present in baseline.
    await asyncio.sleep(max(0.35, body.delay_ms / 1000))
    key = body.key if release == 'A' else str(uuid.uuid4())
    order = Order(id=str(uuid.uuid4()), release=release, session=sid, checkout_key=key, total_cents=total(items, body.discount, release))
    try:
        with Session.begin() as db:
            db.add(order)
    except IntegrityError:
        with Session() as db:
            order = db.query(Order).filter_by(release=release, session=sid, checkout_key=key).one()
    put('cart', f'cart:{release}:{sid}', {})
    return {'id': order.id, 'total_cents': order.total_cents, 'reused': False}
