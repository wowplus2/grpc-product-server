import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entity/product.entity';
import { StockDecreaseLog } from './entity/stock-decrease-log.entity';
import {
  CreateProductRequestDto,
  DecreaseStockRequestDto,
  FindOneRequestDto,
} from './product.dto';
import {
  CreateProductResponse,
  DecreaseStockResponse,
  FindOneResponse,
} from './product.pb';

@Injectable()
export class ProductService {
  @InjectRepository(Product)
  private readonly repository: Repository<Product>;

  @InjectRepository(StockDecreaseLog)
  private readonly decreaseLogRepository: Repository<StockDecreaseLog>;

  public async findOne({ id }: FindOneRequestDto): Promise<FindOneResponse> {
    console.log(`ProductService::findOne()`);
    console.log(id);
    const product: Product = await this.repository.findOne({ where: { id } });
    if (!product) {
      return {
        status: HttpStatus.NOT_FOUND,
        error: ['product not found.'],
        data: null,
      };
    }

    return { status: HttpStatus.OK, error: null, data: product };
  }

  public async createProduct(
    payload: CreateProductRequestDto,
  ): Promise<CreateProductResponse> {
    const product: Product = new Product();

    product.name = payload.name;
    product.sku = payload.sku;
    product.stock = payload.stock;
    product.price = payload.price;

    await this.repository.save(product);

    return { status: HttpStatus.OK, error: null, id: product.id };
  }

  public async decreaseStock({
    id,
    orderId,
  }: DecreaseStockRequestDto): Promise<DecreaseStockResponse> {
    const product: Product = await this.repository.findOne({
      select: ['id', 'stock'],
      where: { id },
    });

    if (!product) {
      return { status: HttpStatus.NOT_FOUND, error: ['Product no found.'] };
    } else if (product.stock <= 0) {
      return { status: HttpStatus.CONFLICT, error: ['Stock too low.'] };
    }

    const isAlreadyDecreased: number = await this.decreaseLogRepository.count({
      where: { orderId },
    });
    if (isAlreadyDecreased) {
      // ????????? ????????? ??????????????? ???????????? ????????? ????????? ??????????????? ?????? ???????????? ???????????? ????????? ??????.
      return {
        status: HttpStatus.CONFLICT,
        error: ['Stock already decreased.'],
      };
    }

    await this.repository.update(product.id, { stock: product.stock - 1 });
    await this.decreaseLogRepository.insert({ product, orderId });

    return { status: HttpStatus.OK, error: null };
  }
}
